// server/src/features/onboarding/bulkImport.service.js
//
// Phase 1 — Company Identity Layer
//
// Async bulk onboarding engine.
// NEVER runs synchronously in an HTTP request beyond file validation.
//
// Architecture:
//   startBulkJob()           — parse, validate, create BulkOnboardingJob, kick off worker
//   _processJobBatches()     — background worker (setImmediate), batches of 20 / 200ms delay
//   _resolveDeptMap()        — pre-loads departmentName→ObjectId map for this company
//   getJobStatus()           — reads BulkOnboardingJob from MongoDB (not in-memory)
//
// Security:
//   - owner role blocked in bulk import (spec requirement)
//   - Invalid roles default to 'member' with a warning (not a hard fail)
//   - Duplicate emails within the file → second occurrence skipped + warning
//   - Department names resolved via pre-loaded map; unresolved → warning, not error

const crypto = require('crypto');
const XLSX = require('xlsx');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Department = require('../../../models/Department');
const BulkOnboardingJob = require('./BulkOnboardingJob');
const { onboardIndividual, ASSIGNABLE_ROLES } = require('./onboarding.service');

// ============================================================================
// CONSTANTS
// ============================================================================

const BATCH_SIZE = 20;
const BATCH_DELAY = 200;  // ms between batches — Brevo rate limiting
const MAX_ROWS = 500;

// Roles blocked in bulk import even if the requester could assign them individually
const BULK_BLOCKED_ROLES = ['owner'];

// ============================================================================
// HELPERS
// ============================================================================

function _makeJobId() {
    return `bjob_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

const _delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * Pre-load a companyName → ObjectId map for all active departments in the company.
 * Called ONCE before the batch loop begins.
 *
 * @param {string} companyId
 * @returns {Promise<Map<string, string>>}  lowercase name → ObjectId string
 */
async function _resolveDeptMap(companyId) {
    const depts = await Department.find({
        company: companyId,
        isActive: true,
    }).select('_id name').lean();

    return new Map(depts.map(d => [d.name.toLowerCase().trim(), d._id.toString()]));
}

/**
 * Parse an Excel/CSV buffer.
 * Supports the 10-column format (current template) and 5-column legacy format.
 *
 * @param {Buffer} buffer
 * @returns {{ rows: Object[], parseError?: string }}
 */
function _parseFile(buffer) {
    try {
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const dataRows = raw.slice(1).filter(r => r[2] || r[1]); // email at col 2 (new) or 1 (old)

        const rows = dataRows.map(r => {
            const isNewFormat = String(r[2] || '').includes('@');
            if (isNewFormat) {
                // 10-col: FirstName(0) LastName(1) Email(2) PersonalEmail(3)
                //         JobTitle(4) JoiningDate(5) Mobile(6) CorpId(7) Role(8) Dept(9)
                return {
                    firstName: String(r[0] || '').trim(),
                    lastName: String(r[1] || '').trim(),
                    email: String(r[2] || '').trim().toLowerCase(),
                    jobTitle: String(r[4] || '').trim(),
                    joiningDate: r[5] ? new Date(r[5]) : null,
                    role: String(r[8] || 'member').trim().toLowerCase(),
                    department: String(r[9] || '').trim(),
                };
            }
            // Legacy 5-col: Name(0) Email(1) Phone(2) Role(3) Dept(4)
            return {
                firstName: String(r[0] || '').trim(),
                lastName: '',
                email: String(r[1] || '').trim().toLowerCase(),
                role: String(r[3] || 'member').trim().toLowerCase(),
                department: String(r[4] || '').trim(),
            };
        }).filter(r => r.email);

        return { rows };
    } catch (err) {
        return { rows: [], parseError: `File parse failed: ${err.message}` };
    }
}

/**
 * Validate raw rows and return { validRows, errors }.
 * Hard validation only — role sanitization handled per-row in the worker.
 */
function _validateRows(rows, requesterRole) {
    const allowedRoles = ASSIGNABLE_ROLES[requesterRole] || [];
    const errors = [];
    const validRows = [];

    for (const row of rows) {
        if (!row.email) {
            errors.push({ email: '(missing)', error: 'Row skipped — email is empty.' });
            continue;
        }
        if (BULK_BLOCKED_ROLES.includes(row.role)) {
            errors.push({ email: row.email, error: `Role '${row.role}' cannot be assigned via bulk import.` });
            continue;
        }
        // Invalid role → sanitize to 'member' in worker (not a hard error)
        validRows.push(row);
    }

    return { validRows, errors };
}

// ============================================================================
// BACKGROUND WORKER
// ============================================================================

/**
 * Process bulk job rows in background batches.
 * Mutates the BulkOnboardingJob document in MongoDB after each batch.
 *
 * @param {string}      jobId
 * @param {Object[]}    rows       — validated, de-duplicated rows
 * @param {string}      companyId
 * @param {string}      requesterRole
 * @param {string}      invitedBy
 * @param {Map}         deptMap    — pre-resolved name→ObjectId map
 */
async function _processJobBatches(jobId, rows, companyId, requesterRole, invitedBy, deptMap) {
    const allowedRoles = ASSIGNABLE_ROLES[requesterRole] || [];
    let processedRows = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];
    const warnings = [];

    try {
        await BulkOnboardingJob.findOneAndUpdate(
            { jobId },
            { $set: { status: 'processing', startedAt: new Date() } }
        );

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);

            for (const row of batch) {
                try {
                    // Role sanitization (spec: invalid → member, add warning)
                    let resolvedRole = row.role;
                    if (!allowedRoles.includes(resolvedRole)) {
                        warnings.push({
                            email: row.email,
                            warning: `Role '${resolvedRole}' not allowed by ceiling — defaulted to 'member'.`,
                        });
                        resolvedRole = 'member';
                    }

                    // Department resolution (name → ObjectId from pre-loaded map)
                    const departmentIds = [];
                    if (row.department) {
                        const deptId = deptMap.get(row.department.toLowerCase().trim());
                        if (deptId) {
                            departmentIds.push(deptId);
                        } else {
                            warnings.push({
                                email: row.email,
                                warning: `Department '${row.department}' not found — skipped dept assignment.`,
                            });
                        }
                    }

                    // Core: onboardIndividual (creates user, runs assignMembers, sends invite)
                    await onboardIndividual({
                        companyId,
                        requesterRole,
                        invitedBy,
                        email: row.email,
                        firstName: row.firstName || row.email.split('@')[0],
                        lastName: row.lastName || '',
                        companyRole: resolvedRole,
                        departmentIds,
                        jobTitle: row.jobTitle || '',
                        joiningDate: row.joiningDate || null,
                    });

                    results.push({ email: row.email, name: `${row.firstName} ${row.lastName}`.trim(), status: 'created' });
                    createdCount++;

                } catch (err) {
                    const isSkip = err.status === 409;
                    results.push({
                        email: row.email,
                        status: isSkip ? 'skipped' : 'error',
                        reason: err.message,
                    });
                    if (isSkip) skippedCount++;
                    else errorCount++;
                } finally {
                    processedRows++;
                }
            }

            // Persist progress after each batch
            await BulkOnboardingJob.findOneAndUpdate(
                { jobId },
                {
                    $set: {
                        processedRows,
                        createdCount,
                        skippedCount,
                        errorCount,
                        results: results.slice(-500), // cap at 500 to avoid doc bloat
                        warnings: warnings.slice(-200),
                    },
                }
            );

            // Throttle between batches
            if (i + BATCH_SIZE < rows.length) {
                await _delay(BATCH_DELAY);
            }
        }

        // Mark complete
        await BulkOnboardingJob.findOneAndUpdate(
            { jobId },
            {
                $set: {
                    status: 'done',
                    completedAt: new Date(),
                    processedRows,
                    createdCount,
                    skippedCount,
                    errorCount,
                    results: results.slice(-500),
                    warnings: warnings.slice(-200),
                },
            }
        );

    } catch (fatalErr) {
        console.error('[BULK] Fatal worker error for job', jobId, fatalErr.message);
        await BulkOnboardingJob.findOneAndUpdate(
            { jobId },
            { $set: { status: 'failed', completedAt: new Date() } }
        ).catch(() => { });
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start a bulk import job.
 *
 * 1. Parse the Excel/CSV buffer
 * 2. Validate rows (hard failures only)
 * 3. De-duplicate emails within the file
 * 4. Create BulkOnboardingJob in MongoDB
 * 5. Kick off background worker via setImmediate
 * 6. Return { jobId, total } immediately (HTTP layer returns 202)
 *
 * @param {Object}  params
 * @param {string}  params.companyId
 * @param {string}  params.requesterRole
 * @param {Buffer}  params.fileBuffer
 * @param {string}  params.invitedBy
 * @returns {Promise<{ jobId: string, total: number, validationErrors: Object[] }>}
 */
async function startBulkJob({ companyId, requesterRole, fileBuffer, invitedBy }) {
    // 1. Parse file
    const { rows, parseError } = _parseFile(fileBuffer);
    if (parseError) {
        throw Object.assign(new Error(parseError), { status: 400 });
    }
    if (rows.length === 0) {
        throw Object.assign(new Error('No valid rows found in the uploaded file.'), { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
        throw Object.assign(
            new Error(`Maximum ${MAX_ROWS} employees per import. Split your file into smaller batches.`),
            { status: 400 }
        );
    }

    // 2. Hard validation pass
    const { validRows, errors: validationErrors } = _validateRows(rows, requesterRole);

    // 3. De-duplicate by email within the file
    const seenEmails = new Set();
    const deduped = [];
    const dupWarnings = [];
    for (const row of validRows) {
        if (seenEmails.has(row.email)) {
            dupWarnings.push({ email: row.email, warning: 'Duplicate email in file — second occurrence skipped.' });
        } else {
            seenEmails.add(row.email);
            deduped.push(row);
        }
    }

    // 4. Pre-resolve department names (done once, reused by all rows)
    const deptMap = await _resolveDeptMap(companyId);

    // 5. Create persistent BulkOnboardingJob record
    const jobId = _makeJobId();
    await BulkOnboardingJob.create({
        jobId,
        companyId,
        createdBy: invitedBy,
        status: 'queued',
        totalRows: deduped.length,
        processedRows: 0,
        warnings: dupWarnings,
    });

    // 6. Kick off background worker (non-blocking)
    setImmediate(() => {
        _processJobBatches(jobId, deduped, companyId, requesterRole, invitedBy, deptMap)
            .catch(err => console.error('[BULK] Unhandled worker error:', err.message));
    });

    return {
        jobId,
        total: deduped.length,
        validationErrors, // hard-fail rows returned immediately (not in the async job)
    };
}

/**
 * Read job status from MongoDB.
 * Enforces company isolation: returns null if jobId exists but belongs to another company.
 *
 * @param {string} jobId
 * @param {string} companyId
 * @returns {Promise<Object|null>}
 */
async function getJobStatus(jobId, companyId) {
    const job = await BulkOnboardingJob.findOne({ jobId, companyId }).lean();
    return job || null;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    startBulkJob,
    getJobStatus,
    _resolveDeptMap, // exported for testing
    _parseFile,      // exported for testing
};

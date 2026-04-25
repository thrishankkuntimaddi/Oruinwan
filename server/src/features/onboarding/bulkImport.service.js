const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Department = require('../../../models/Department');
const BulkOnboardingJob = require('./BulkOnboardingJob');
const { onboardIndividual, ASSIGNABLE_ROLES } = require('./onboarding.service');
const sendEmail = require('../../../utils/sendEmail');
const { bulkWelcomeTemplate } = require('../../../utils/emailTemplates');

const BATCH_SIZE = 20;
const BATCH_DELAY = 200;  
const MAX_ROWS = 500;

const BULK_BLOCKED_ROLES = ['owner'];

function _makeJobId() {
    
    return `bjob_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

const _delay = ms => new Promise(r => setTimeout(r, ms));

function _generateTempPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '@#$!';
    const all = upper + lower + digits + symbols;
    let pwd = [
        upper[Math.floor(Math.random() * upper.length)],
        lower[Math.floor(Math.random() * lower.length)],
        digits[Math.floor(Math.random() * digits.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
    ];
    for (let i = 4; i < 12; i++) pwd.push(all[Math.floor(Math.random() * all.length)]);
    
    return pwd.sort(() => Math.random() - 0.5).join('');
}

async function _sendWelcomeEmail({ toEmail, name, workEmail, companyName, tempPassword }) {
    const tpl = bulkWelcomeTemplate(name, workEmail, tempPassword, companyName);
    try {
        await sendEmail({ to: toEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });
        return { sent: true };
    } catch (err) {
        console.warn('[BULK] Welcome email failed for', toEmail, '—', err.message);
        return { sent: false, reason: err.message };
    }
}

async function _resolveDeptMap(companyId) {
    const depts = await Department.find({
        company: companyId,
        isActive: true,
    }).select('_id name').lean();

    return new Map(depts.map(d => [d.name.toLowerCase().trim(), d._id.toString()]));
}

function _parseFile(buffer) {
    try {
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const dataRows = raw.slice(1).filter(r => r[2] || r[1]); 

        const rows = dataRows.map(r => {
            const isNewFormat = String(r[2] || '').includes('@');
            if (isNewFormat) {
                
                
                return {
                    firstName: String(r[0] || '').trim(),
                    lastName: String(r[1] || '').trim(),
                    email: String(r[2] || '').trim().toLowerCase(),
                    personalEmail: String(r[3] || '').trim().toLowerCase(), 
                    jobTitle: String(r[4] || '').trim(),
                    joiningDate: r[5] ? new Date(r[5]) : null,
                    role: String(r[8] || 'member').trim().toLowerCase(),
                    department: String(r[9] || '').trim(),
                };
            }
            
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
        
        validRows.push(row);
    }

    return { validRows, errors };
}

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

        
        const company = await Company.findById(companyId).select('name').lean();
        const companyName = company?.name || 'your company';

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);

            for (const row of batch) {
                try {
                    
                    let resolvedRole = row.role;
                    if (!allowedRoles.includes(resolvedRole)) {
                        warnings.push({
                            email: row.email,
                            warning: `Role '${resolvedRole}' not allowed by ceiling — defaulted to 'member'.`,
                        });
                        resolvedRole = 'member';
                    }

                    
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

                    
                    const tempPassword = _generateTempPassword();
                    const passwordHash = await bcrypt.hash(tempPassword, 10);

                    
                    
                    await onboardIndividual({
                        companyId,
                        requesterRole,
                        invitedBy,
                        email: row.email,                           
                        personalEmail: row.personalEmail || '',     
                        firstName: row.firstName || row.email.split('@')[0],
                        lastName: row.lastName || '',
                        companyRole: resolvedRole,
                        departmentIds,
                        jobTitle: row.jobTitle || '',
                        joiningDate: row.joiningDate || null,
                        bulkTempPasswordHash: passwordHash,        
                    });

                    
                    const notifyEmail = row.personalEmail || row.email;
                    const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email;
                    await _sendWelcomeEmail({
                        toEmail: notifyEmail,
                        name: fullName,
                        workEmail: row.email,
                        companyName,
                        tempPassword,
                    });

                    results.push({ email: row.email, name: fullName, status: 'created' });
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

            
            await BulkOnboardingJob.findOneAndUpdate(
                { jobId },
                {
                    $set: {
                        processedRows,
                        createdCount,
                        skippedCount,
                        errorCount,
                        results: results.slice(-500), 
                        warnings: warnings.slice(-200),
                    },
                }
            );

            
            if (i + BATCH_SIZE < rows.length) {
                await _delay(BATCH_DELAY);
            }
        }

        
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

async function startBulkJob({ companyId, requesterRole, fileBuffer, invitedBy }) {
    
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

    
    const { validRows, errors: validationErrors } = _validateRows(rows, requesterRole);

    
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

    
    const deptMap = await _resolveDeptMap(companyId);

    
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

    
    setImmediate(() => {
        _processJobBatches(jobId, deduped, companyId, requesterRole, invitedBy, deptMap)
            .catch(err => console.error('[BULK] Unhandled worker error:', err.message));
    });

    return {
        jobId,
        total: deduped.length,
        validationErrors, 
    };
}

async function getJobStatus(jobId, companyId) {
    const job = await BulkOnboardingJob.findOne({ jobId, companyId }).lean();
    return job || null;
}

module.exports = {
    startBulkJob,
    getJobStatus,
    _resolveDeptMap, 
    _parseFile,      
};

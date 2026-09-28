import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@services/api';
import DashShell from '../company-dash/DashShell';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../company-dash/dashNav';
import logger from '../../utils/logger';

const STORE_KEY = 'oruinwan.manager.department';
const readStore = () => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } };
const writeStore = (v) => { try { localStorage.setItem(STORE_KEY, v); } catch { /* storage blocked */ } };

/**
 * Frame for the Manager console. A manager sees the departments they manage
 * (GET /api/managers/scope); an owner or admin can look at any department
 * (GET /api/departments). The chosen department is passed to every page as
 * the outlet context { selectedDepartment, departments, departmentsLoading }.
 */
const ManagerLayout = () => {
    const { user } = useAuth();
    const admin = isAdminUser(user);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(readStore);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = admin ? await api.get('/api/departments') : await api.get('/api/managers/scope');
            const list = (res.data?.departments || []).filter((d) => d && d._id);
            setDepartments(list);
        } catch (err) {
            logger.error('Manager scope load failed', err);
            setError(err?.response?.data?.message || 'Could not load your departments');
        } finally {
            setLoading(false);
        }
    }, [admin]);

    useEffect(() => { load(); }, [load]);

    const selectedDepartment = useMemo(
        () => departments.find((d) => String(d._id) === String(selectedId)) || departments[0] || null,
        [departments, selectedId],
    );

    const choose = useCallback((id) => { setSelectedId(id); writeStore(id); }, []);

    const outletContext = useMemo(() => ({
        selectedDepartment,
        departments,
        departmentsLoading: loading,
        departmentsError: error,
        reloadDepartments: load,
        selectDepartment: choose,
    }), [selectedDepartment, departments, loading, error, load, choose]);

    const topExtra = departments.length > 1 ? (
        <select
            className="gl-input cd-select"
            aria-label="Department"
            value={selectedDepartment?._id || ''}
            onChange={(e) => choose(e.target.value)}
            style={{ maxWidth: 180 }}
        >
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
    ) : null;

    return <DashShell outletContext={outletContext} topExtra={topExtra} />;
};

export default ManagerLayout;

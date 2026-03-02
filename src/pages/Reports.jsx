import { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    Download,
    Filter,
    Calendar,
    Search,
    Users,
    UserCheck,
    Clock,
    AlertTriangle,
    ScanFace,
    Fingerprint,
    RefreshCw,
} from 'lucide-react';
import DataTable from '../components/DataTable';
import { useAttendance } from '../hooks/useAttendance';
import { exportToCSV } from '../services/attendanceService';
import { getEmployees } from '../services/biometricService';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Reports() {
    const { logs, totalCount, fetchLogs, loading } = useAttendance();
    const [employees, setEmployees] = useState([]);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        dateFrom: format(new Date(), 'yyyy-MM-dd'),
        dateTo: format(new Date(), 'yyyy-MM-dd'),
        department: '',
        employeeId: '',
        status: '',
    });

    // Fetch employees for filter dropdown
    useEffect(() => {
        const loadEmployees = async () => {
            const result = await getEmployees({ isActive: true });
            if (result.success) setEmployees(result.data);
        };
        loadEmployees();
    }, []);

    // Fetch logs when filters or page change
    const loadLogs = useCallback(() => {
        fetchLogs({ ...filters, page, pageSize: 30 });
    }, [filters, page, fetchLogs]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const handleExport = () => {
        if (logs.length === 0) {
            toast.error('No data to export');
            return;
        }
        exportToCSV(logs, 'attendance_report');
        toast.success('CSV exported successfully');
    };

    // Calculate summary from current logs
    const summary = {
        totalPresent: new Set(
            logs.filter((l) => l.status === 'success').map((l) => l.employee_id)
        ).size,
        totalLate: 0, // Would need shift data for this
        totalFailed: logs.filter((l) => l.status === 'failed').length,
        totalRecords: logs.length,
    };

    const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];

    const columns = [
        {
            key: 'check_in',
            label: 'Date/Time',
            render: (val) => (
                <div>
                    <p className="text-sm text-surface-200">
                        {val ? format(new Date(val), 'MMM dd, yyyy') : '—'}
                    </p>
                    <p className="text-[11px] text-surface-500">
                        {val ? format(new Date(val), 'hh:mm:ss a') : '—'}
                    </p>
                </div>
            ),
        },
        {
            key: 'employees',
            label: 'Employee',
            render: (val) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {val?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-surface-200">
                            {val?.name || 'Unknown'}
                        </p>
                        <p className="text-[11px] text-surface-500">
                            {val?.employee_code || '—'} · {val?.department || '—'}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'check_out',
            label: 'Check Out',
            render: (val) => (
                <span className="text-sm text-surface-300">
                    {val ? format(new Date(val), 'hh:mm:ss a') : '—'}
                </span>
            ),
        },
        {
            key: 'verification_method',
            label: 'Method',
            render: (val) => (
                <div className="flex items-center gap-1.5">
                    {val === 'fingerprint' ? (
                        <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                        <ScanFace className="w-3.5 h-3.5 text-primary-400" />
                    )}
                    <span className="text-sm text-surface-300 capitalize">{val || 'face'}</span>
                </div>
            ),
        },
        {
            key: 'confidence_score',
            label: 'Confidence',
            render: (val) => {
                if (!val) return <span className="text-surface-500">—</span>;
                const pct = (val * 100).toFixed(1);
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${val >= 0.85
                                        ? 'bg-success-500'
                                        : val >= 0.75
                                            ? 'bg-warning-500'
                                            : 'bg-danger-500'
                                    }`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="text-xs text-surface-400 font-mono">{pct}%</span>
                    </div>
                );
            },
        },
        {
            key: 'status',
            label: 'Status',
            render: (val) => (
                <span
                    className={`badge ${val === 'success' ? 'badge-success' : 'badge-danger'
                        }`}
                >
                    {val === 'success' ? 'Success' : 'Failed'}
                </span>
            ),
        },
        {
            key: 'device_id',
            label: 'Device',
            render: (val) => (
                <span className="text-xs text-surface-500 font-mono">{val || '—'}</span>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Attendance Reports</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        View, filter, and export attendance records
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadLogs}
                        className="btn-secondary"
                        id="btn-refresh-reports"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
                        className="btn-primary"
                        id="btn-export-csv"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-success-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">{summary.totalPresent}</p>
                        <p className="text-[11px] text-surface-500">Present</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning-500/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-warning-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">{summary.totalLate}</p>
                        <p className="text-[11px] text-surface-500">Late</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-danger-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-danger-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">{summary.totalFailed}</p>
                        <p className="text-[11px] text-surface-500">Failed</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">{summary.totalRecords}</p>
                        <p className="text-[11px] text-surface-500">Total Records</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface-800/30 border border-surface-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4 text-sm font-medium text-surface-400">
                    <Filter className="w-4 h-4" />
                    Filters
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Date From */}
                    <div>
                        <label className="form-label">From Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                            id="filter-date-from"
                        />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="form-label">To Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                            id="filter-date-to"
                        />
                    </div>

                    {/* Department */}
                    <div>
                        <label className="form-label">Department</label>
                        <select
                            className="form-select"
                            value={filters.department}
                            onChange={(e) => handleFilterChange('department', e.target.value)}
                            id="filter-report-department"
                        >
                            <option value="">All</option>
                            {departments.map((dept) => (
                                <option key={dept} value={dept}>
                                    {dept}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Employee */}
                    <div>
                        <label className="form-label">Employee</label>
                        <select
                            className="form-select"
                            value={filters.employeeId}
                            onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                            id="filter-employee"
                        >
                            <option value="">All Employees</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.employee_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="form-label">Status</label>
                        <select
                            className="form-select"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            id="filter-report-status"
                        >
                            <option value="">All</option>
                            <option value="success">Success</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={logs}
                totalCount={totalCount}
                page={page}
                pageSize={30}
                onPageChange={setPage}
                loading={loading}
                emptyMessage="No attendance records found for the selected filters"
                emptyIcon={Calendar}
            />
        </div>
    );
}

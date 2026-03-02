import { useState, useEffect, useCallback } from 'react';
import {
    Users,
    Plus,
    Search,
    Filter,
    UserCheck,
    UserX,
    ScanFace,
    Fingerprint,
    Edit3,
    Trash2,
    MoreVertical,
    Download,
} from 'lucide-react';
import DataTable from '../components/DataTable';
import EmployeeForm from '../components/EmployeeForm';
import {
    getEmployees,
    createEmployee,
    updateEmployee,
    deactivateEmployee,
} from '../services/biometricService';
import toast from 'react-hot-toast';

export default function EmployeeManagement() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [actionMenu, setActionMenu] = useState(null);

    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        const filters = {};
        if (search) filters.search = search;
        if (departmentFilter) filters.department = departmentFilter;
        if (statusFilter !== '') filters.isActive = statusFilter === 'active';

        const result = await getEmployees(filters);
        if (result.success) {
            setEmployees(result.data);
            setTotalCount(result.count);
        }
        setLoading(false);
    }, [search, departmentFilter, statusFilter]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const handleCreateEmployee = async (data) => {
        const result = await createEmployee(data);
        if (result.success) {
            toast.success('Employee added successfully');
            setShowForm(false);
            fetchEmployees();
        } else {
            toast.error(result.error || 'Failed to add employee');
        }
    };

    const handleUpdateEmployee = async (data) => {
        const result = await updateEmployee(editingEmployee.id, data);
        if (result.success) {
            toast.success('Employee updated successfully');
            setEditingEmployee(null);
            setShowForm(false);
            fetchEmployees();
        } else {
            toast.error(result.error || 'Failed to update employee');
        }
    };

    const handleDeactivate = async (employeeId) => {
        if (!confirm('Are you sure you want to deactivate this employee?')) return;

        const result = await deactivateEmployee(employeeId);
        if (result.success) {
            toast.success('Employee deactivated');
            fetchEmployees();
        } else {
            toast.error(result.error || 'Failed to deactivate');
        }
        setActionMenu(null);
    };

    const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];

    const columns = [
        {
            key: 'employee_code',
            label: 'Code',
            width: '100px',
            render: (val) => (
                <span className="font-mono text-primary-400 font-medium text-xs">{val}</span>
            ),
        },
        {
            key: 'name',
            label: 'Employee',
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {val?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <p className="font-medium text-surface-100 text-sm">{val}</p>
                        <p className="text-[11px] text-surface-500">{row.department}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'department',
            label: 'Department',
            render: (val) => (
                <span className="text-surface-300">{val}</span>
            ),
        },
        {
            key: 'face_embedding',
            label: 'Biometrics',
            sortable: false,
            render: (val, row) => (
                <div className="flex items-center gap-2">
                    <div
                        className={`p-1 rounded ${val ? 'bg-success-500/10' : 'bg-surface-700'}`}
                        title={val ? 'Face enrolled' : 'Face not enrolled'}
                    >
                        <ScanFace
                            className={`w-3.5 h-3.5 ${val ? 'text-success-400' : 'text-surface-500'
                                }`}
                        />
                    </div>
                    <div
                        className={`p-1 rounded ${row.fingerprint_template ? 'bg-success-500/10' : 'bg-surface-700'
                            }`}
                        title={
                            row.fingerprint_template
                                ? 'Fingerprint enrolled'
                                : 'Fingerprint not enrolled'
                        }
                    >
                        <Fingerprint
                            className={`w-3.5 h-3.5 ${row.fingerprint_template
                                    ? 'text-success-400'
                                    : 'text-surface-500'
                                }`}
                        />
                    </div>
                </div>
            ),
        },
        {
            key: 'is_active',
            label: 'Status',
            width: '90px',
            render: (val) => (
                <span className={`badge ${val ? 'badge-success' : 'badge-danger'}`}>
                    {val ? 'Active' : 'Inactive'}
                </span>
            ),
        },
        {
            key: 'actions',
            label: '',
            sortable: false,
            width: '60px',
            render: (_, row) => (
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActionMenu(actionMenu === row.id ? null : row.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-500 hover:text-surface-300 transition-colors"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>

                    {actionMenu === row.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl z-20 overflow-hidden animate-fade-in">
                            <button
                                onClick={() => {
                                    setEditingEmployee(row);
                                    setShowForm(true);
                                    setActionMenu(null);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit Employee
                            </button>
                            <button
                                onClick={() => handleDeactivate(row.id)}
                                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-danger-400 hover:bg-danger-500/10 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Deactivate
                            </button>
                        </div>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Employees</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        Manage workforce and biometric enrollment
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingEmployee(null);
                        setShowForm(true);
                    }}
                    className="btn-primary"
                    id="btn-add-employee"
                >
                    <Plus className="w-4 h-4" />
                    Add Employee
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">{totalCount}</p>
                        <p className="text-[11px] text-surface-500">Total</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-success-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">
                            {employees.filter((e) => e.is_active).length}
                        </p>
                        <p className="text-[11px] text-surface-500">Active</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center">
                        <ScanFace className="w-5 h-5 text-success-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">
                            {employees.filter((e) => e.face_embedding).length}
                        </p>
                        <p className="text-[11px] text-surface-500">Face Enrolled</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning-500/10 flex items-center justify-center">
                        <UserX className="w-5 h-5 text-warning-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">
                            {employees.filter((e) => !e.face_embedding).length}
                        </p>
                        <p className="text-[11px] text-surface-500">Not Enrolled</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                        type="text"
                        className="form-input pl-10"
                        placeholder="Search by name or code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        id="input-search-employees"
                    />
                </div>
                <select
                    className="form-select w-full sm:w-44"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    id="filter-department"
                >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                        <option key={dept} value={dept}>
                            {dept}
                        </option>
                    ))}
                </select>
                <select
                    className="form-select w-full sm:w-36"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    id="filter-status"
                >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {/* Table */}
            <DataTable
                columns={columns}
                data={employees}
                totalCount={totalCount}
                page={page}
                pageSize={20}
                onPageChange={setPage}
                loading={loading}
                emptyMessage="No employees found"
                emptyIcon={Users}
            />

            {/* Click away to close action menu */}
            {actionMenu && (
                <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
            )}

            {/* Employee Form Modal */}
            {showForm && (
                <EmployeeForm
                    employee={editingEmployee}
                    onSubmit={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
                    onCancel={() => {
                        setShowForm(false);
                        setEditingEmployee(null);
                    }}
                    departments={departments}
                />
            )}
        </div>
    );
}

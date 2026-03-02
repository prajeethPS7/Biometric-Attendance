import { useState, useEffect, useCallback } from 'react';
import {
    Monitor,
    Plus,
    MapPin,
    Power,
    Edit3,
    Trash2,
    Wifi,
    WifiOff,
    Loader2,
    X,
    Save,
} from 'lucide-react';
import {
    getDevices,
    createDevice,
    updateDevice,
    toggleDeviceStatus,
} from '../services/biometricService';
import toast from 'react-hot-toast';

export default function DeviceManagement() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [formData, setFormData] = useState({
        device_name: '',
        location: '',
        is_active: true,
    });

    const fetchDevices = useCallback(async () => {
        setLoading(true);
        const result = await getDevices();
        if (result.success) {
            setDevices(result.data);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    const handleOpenForm = (device = null) => {
        if (device) {
            setEditingDevice(device);
            setFormData({
                device_name: device.device_name,
                location: device.location,
                is_active: device.is_active,
            });
        } else {
            setEditingDevice(null);
            setFormData({ device_name: '', location: '', is_active: true });
        }
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.device_name.trim() || !formData.location.trim()) {
            toast.error('Please fill in all fields');
            return;
        }

        let result;
        if (editingDevice) {
            result = await updateDevice(editingDevice.id, formData);
        } else {
            result = await createDevice(formData);
        }

        if (result.success) {
            toast.success(
                editingDevice ? 'Device updated successfully' : 'Device added successfully'
            );
            setShowForm(false);
            fetchDevices();
        } else {
            toast.error(result.error || 'Failed to save device');
        }
    };

    const handleToggleStatus = async (device) => {
        const result = await toggleDeviceStatus(device.id, !device.is_active);
        if (result.success) {
            toast.success(
                `Device ${!device.is_active ? 'activated' : 'deactivated'}`
            );
            fetchDevices();
        } else {
            toast.error('Failed to update device status');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Devices</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        Manage kiosk and scanner devices
                    </p>
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="btn-primary"
                    id="btn-add-device"
                >
                    <Plus className="w-4 h-4" />
                    Add Device
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">{devices.length}</p>
                        <p className="text-[11px] text-surface-500">Total Devices</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center">
                        <Wifi className="w-5 h-5 text-success-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">
                            {devices.filter((d) => d.is_active).length}
                        </p>
                        <p className="text-[11px] text-surface-500">Active</p>
                    </div>
                </div>
                <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-danger-500/10 flex items-center justify-center">
                        <WifiOff className="w-5 h-5 text-danger-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-surface-100">
                            {devices.filter((d) => !d.is_active).length}
                        </p>
                        <p className="text-[11px] text-surface-500">Inactive</p>
                    </div>
                </div>
            </div>

            {/* Device Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-surface-800/50 border border-surface-700/50 rounded-2xl p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="skeleton w-12 h-12 rounded-xl" />
                                <div className="skeleton w-16 h-6 rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <div className="skeleton h-5 w-3/4 rounded" />
                                <div className="skeleton h-4 w-1/2 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center">
                        <Monitor className="w-8 h-8 text-surface-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-medium text-surface-400">No devices configured</p>
                        <p className="text-sm text-surface-600 mt-1">
                            Add your first kiosk or scanner device
                        </p>
                    </div>
                    <button
                        onClick={() => handleOpenForm()}
                        className="btn-primary mt-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Device
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map((device, i) => (
                        <div
                            key={device.id}
                            className={`bg-surface-800/50 border rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-surface-950/50 animate-slide-in-up ${device.is_active
                                    ? 'border-surface-700/50 hover:border-success-500/20'
                                    : 'border-surface-700/30 opacity-60 hover:opacity-100'
                                }`}
                            style={{ animationDelay: `${i * 80}ms` }}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${device.is_active
                                            ? 'bg-success-500/10'
                                            : 'bg-surface-700'
                                        }`}
                                >
                                    <Monitor
                                        className={`w-6 h-6 ${device.is_active ? 'text-success-400' : 'text-surface-500'
                                            }`}
                                    />
                                </div>
                                <span
                                    className={`badge ${device.is_active ? 'badge-success' : 'badge-danger'
                                        }`}
                                >
                                    {device.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            {/* Info */}
                            <h3 className="font-semibold text-surface-100 text-lg mb-1">
                                {device.device_name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-sm text-surface-500 mb-6">
                                <MapPin className="w-3.5 h-3.5" />
                                {device.location}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-4 border-t border-surface-700/50">
                                <button
                                    onClick={() => handleToggleStatus(device)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${device.is_active
                                            ? 'bg-danger-500/10 text-danger-400 hover:bg-danger-500/20'
                                            : 'bg-success-500/10 text-success-400 hover:bg-success-500/20'
                                        }`}
                                >
                                    <Power className="w-3 h-3" />
                                    {device.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                    onClick={() => handleOpenForm(device)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors"
                                >
                                    <Edit3 className="w-3 h-3" />
                                    Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80"
                    style={{ backdropFilter: 'blur(4px)' }}
                >
                    <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-md animate-slide-in-up">
                        <div className="flex items-center justify-between p-5 border-b border-surface-700">
                            <h2 className="text-lg font-bold text-surface-100">
                                {editingDevice ? 'Edit Device' : 'Add Device'}
                            </h2>
                            <button
                                onClick={() => setShowForm(false)}
                                className="p-2 rounded-lg hover:bg-surface-700 text-surface-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-5">
                            <div>
                                <label className="form-label">Device Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Main Entrance Kiosk"
                                    value={formData.device_name}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, device_name: e.target.value }))
                                    }
                                    id="input-device-name"
                                />
                            </div>

                            <div>
                                <label className="form-label">Location</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Building A - Ground Floor"
                                    value={formData.location}
                                    onChange={(e) =>
                                        setFormData((p) => ({ ...p, location: e.target.value }))
                                    }
                                    id="input-device-location"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) =>
                                            setFormData((p) => ({ ...p, is_active: e.target.checked }))
                                        }
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-surface-700 peer-focus:ring-2 peer-focus:ring-primary-500/30 rounded-full peer peer-checked:bg-primary-600 transition-colors">
                                        <div
                                            className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${formData.is_active ? 'translate-x-[22px]' : 'translate-x-0.5'
                                                }`}
                                        />
                                    </div>
                                </label>
                                <span className="text-sm text-surface-300">Active</span>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    className="btn-primary flex-1 justify-center"
                                    id="btn-submit-device"
                                >
                                    <Save className="w-4 h-4" />
                                    {editingDevice ? 'Update' : 'Add'} Device
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

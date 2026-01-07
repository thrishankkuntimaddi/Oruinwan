// client/src/components/manager/ManagerLocation.jsx
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { MapPin, Navigation, Phone, Globe, Building } from 'lucide-react';

const ManagerLocation = () => {
    const { selectedDepartment } = useOutletContext();

    // Placeholder data - in real app, this would come from department/location API
    const locationDetails = {
        name: "Headquarters - Building A",
        address: "123 Tech Park Blvd, Suite 400",
        city: "San Francisco, CA 94107",
        timezone: "PST (UTC-8)",
        coordinates: "37.7749° N, 122.4194° W",
        contact: "+1 (555) 123-4567"
    };

    return (
        <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Location</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Physical workspace details for {selectedDepartment?.name}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Info Card */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="h-48 bg-indigo-50 dark:bg-indigo-900/20 relative flex items-center justify-center">
                                {/* Map Placeholder */}
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]"></div>
                                <MapPin size={48} className="text-indigo-600 dark:text-indigo-400 relative z-10 animate-bounce" />
                                <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur px-3 py-1 rounded text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-600">
                                    Map View Coming Soon
                                </div>
                            </div>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{locationDetails.name}</h3>
                                <p className="text-gray-500 dark:text-gray-400 flex items-start gap-2">
                                    <MapPin size={18} className="mt-1 shrink-0 text-gray-400" />
                                    {locationDetails.address}<br />{locationDetails.city}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Building size={20} className="text-gray-400" />
                                Department Facilities
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Meeting Rooms</span>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">4 Available</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Capacity</span>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">45/50 Seats</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Floor</span>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">4th Floor</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Access Code</span>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">#9821</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Quick Details</h3>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-sm">
                                    <Globe className="text-gray-400" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Timezone</p>
                                        <p className="text-gray-500 dark:text-gray-400">{locationDetails.timezone}</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-3 text-sm">
                                    <Navigation className="text-gray-400" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Coordinates</p>
                                        <p className="text-gray-500 dark:text-gray-400">{locationDetails.coordinates}</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-3 text-sm">
                                    <Phone className="text-gray-400" size={18} />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">Desk Support</p>
                                        <p className="text-gray-500 dark:text-gray-400">{locationDetails.contact}</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagerLocation;

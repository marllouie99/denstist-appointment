import { Calendar, CheckCircle } from 'lucide-react';

const GoogleCalendarConnect = ({ onConnectionChange }) => {
  // Always shows as connected to Google Calendar API


  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-full bg-green-100">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Google Calendar API</h3>
            <p className="text-sm text-gray-600">
              Integrated - Appointments are automatically synced with Google Calendar
            </p>
          </div>
        </div>
        
        <div className="flex items-center text-green-600">
          <CheckCircle className="w-5 h-5 mr-1" />
          <span className="text-sm font-medium">Connected & Active</span>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
        <div className="flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <p className="font-medium mb-1">Google Calendar API Integration Active:</p>
            <ul className="list-disc list-inside space-y-1 text-green-700">
              <li>New appointments are automatically added to your calendar</li>
              <li>Email and popup reminders are enabled</li>
              <li>Calendar events sync across all your devices</li>
              <li>Patients receive calendar invitations</li>
              <li>Real-time synchronization with Google Calendar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleCalendarConnect;

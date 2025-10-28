import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { appointmentsAPI, paymentsAPI } from '../../lib/api';
import { CreditCard, ArrowLeft, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { formatPHPCurrencyCompact } from '../../utils/currency';

const Payment = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    try {
      const response = await appointmentsAPI.getById(appointmentId);
      setAppointment(response.data.appointment);
    } catch (error) {
      console.error('Error fetching appointment:', error);
      toast.error('Failed to load appointment details');
      navigate('/patient/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);
      
      // Create PayPal payment
      const response = await paymentsAPI.create({
        appointment_id: appointmentId
      });

      if (response.data.approval_url) {
        // Redirect to PayPal for payment
        window.location.href = response.data.approval_url;
      } else {
        toast.error('Failed to create payment');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      const message = error.response?.data?.error || 'Failed to process payment';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Appointment Not Found</h2>
        <button
          onClick={() => navigate('/patient/dashboard')}
          className="btn btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (appointment.status !== 'approved') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Payment Not Available
          </h2>
          <p className="text-gray-600 mb-6">
            This appointment needs to be approved by the dentist before payment can be processed.
          </p>
          <div className="space-y-2 text-sm text-gray-500 mb-6">
            <p><span className="font-medium">Status:</span> {appointment.status}</p>
            <p><span className="font-medium">Appointment:</span> {format(new Date(appointment.appointment_time), 'PPp')}</p>
          </div>
          <button
            onClick={() => navigate('/patient/dashboard')}
            className="btn btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (appointment.payment_status === 'paid') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Payment Completed
          </h2>
          <p className="text-gray-600 mb-6">
            Your payment has been successfully processed for this appointment.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">Service</p>
                <p className="text-gray-600">{appointment.service?.name}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Amount Paid</p>
                <p className="text-gray-600">{formatPHPCurrencyCompact(appointment.service?.price)}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Dentist</p>
                <p className="text-gray-600">Dr. {appointment.dentist?.full_name}</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Date & Time</p>
                <p className="text-gray-600">{format(new Date(appointment.appointment_time), 'PPp')}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/patient/dashboard')}
            className="btn btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/patient/dashboard')}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Complete Payment</h1>
      </div>

      {/* Appointment Details */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Appointment Details
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Service</p>
              <p className="text-gray-900">{appointment.service?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Dentist</p>
              <p className="text-gray-900">Dr. {appointment.dentist?.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Date & Time</p>
              <p className="text-gray-900">
                {format(new Date(appointment.appointment_time), 'PPPP')}
              </p>
              <p className="text-gray-900">
                {format(new Date(appointment.appointment_time), 'p')}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Duration</p>
              <p className="text-gray-900">{appointment.service?.duration || 60} minutes</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {appointment.status}
              </span>
            </div>
            {appointment.notes && (
              <div>
                <p className="text-sm font-medium text-gray-700">Notes</p>
                <p className="text-gray-900 text-sm">{appointment.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Payment Summary
        </h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">{appointment.service?.name}</span>
            <span className="text-gray-900">{formatPHPCurrencyCompact(appointment.service?.price)}</span>
          </div>
          
          <div className="border-t pt-3">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span className="text-gray-900">Total Amount</span>
              <span className="text-blue-600">{formatPHPCurrencyCompact(appointment.service?.price)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Payment Method
        </h2>
        
        <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg bg-blue-50">
          <div className="w-12 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">PayPal</span>
          </div>
          <div>
            <p className="font-medium text-gray-900">PayPal</p>
            <p className="text-sm text-gray-600">Secure payment via PayPal</p>
          </div>
        </div>
        
        <div className="mt-6">
          <button
            onClick={handlePayment}
            disabled={processing}
            className="w-full btn btn-primary py-3 text-lg flex items-center justify-center space-x-2"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                <span>Pay {formatPHPCurrencyCompact(appointment.service?.price)} with PayPal</span>
              </>
            )}
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Your payment is secured by PayPal. You will be redirected to PayPal to complete the transaction.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Payment;

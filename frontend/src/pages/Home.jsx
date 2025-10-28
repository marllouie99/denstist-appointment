import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Users, Shield, CreditCard, Star, Clock, Award, CheckCircle } from 'lucide-react';

const Home = () => {
  const { user } = useAuth();

  // Redirect authenticated users to their dashboard
  if (user) {
    return <Navigate to="/home-dashboard" replace />;
  }

  const features = [
    {
      icon: Calendar,
      title: 'Easy Appointment Booking',
      description: 'Book appointments with your preferred dentist at your convenience.'
    },
    {
      icon: Users,
      title: 'Expert Dentists',
      description: 'Connect with qualified and experienced dental professionals.'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your medical information is protected with enterprise-grade security.'
    },
    {
      icon: CreditCard,
      title: 'Secure Payments',
      description: 'Pay securely through PayPal with instant confirmation.'
    }
  ];

  const getDashboardLink = () => {
    switch (user?.role) {
      case 'patient':
        return '/patient/dashboard';
      case 'dentist':
        return '/dentist/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-gray-900">
            🦷 Your Dental Care, Simplified
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Book appointments, manage your dental health, and connect with top dentists 
            all in one secure platform.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {user ? (
            <Link
              to={getDashboardLink()}
              className="btn btn-primary text-lg px-8 py-3"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="btn btn-primary text-lg px-8 py-3"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="btn btn-secondary text-lg px-8 py-3"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map((feature, index) => (
          <div key={index} className="card p-6 text-center space-y-4">
            <div className="flex justify-center">
              <feature.icon className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              {feature.title}
            </h3>
            <p className="text-gray-600">
              {feature.description}
            </p>
          </div>
        ))}
      </section>

      {/* How It Works */}
      <section className="space-y-12">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Getting dental care has never been easier. Follow these simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold text-blue-600">1</span>
            </div>
            <h3 className="text-xl font-semibold">Create Account</h3>
            <p className="text-gray-600">
              Sign up as a patient or dentist with your email and basic information.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold text-blue-600">2</span>
            </div>
            <h3 className="text-xl font-semibold">Book Appointment</h3>
            <p className="text-gray-600">
              Choose your dentist, select a service, and pick a convenient time slot.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold text-blue-600">3</span>
            </div>
            <h3 className="text-xl font-semibold">Get Care</h3>
            <p className="text-gray-600">
              Attend your appointment and pay securely through our platform.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-blue-600 text-white rounded-2xl p-12">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold mb-2">500+</div>
            <div className="text-blue-100">Happy Patients</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">50+</div>
            <div className="text-blue-100">Expert Dentists</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">1000+</div>
            <div className="text-blue-100">Appointments Completed</div>
          </div>
        </div>
      </section>


      {/* Why Choose Us Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Why Choose DentalCare Platform?
          </h2>
          <p className="text-blue-100 max-w-2xl mx-auto">
            We're committed to revolutionizing dental care through technology and exceptional service.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">24/7 Support</h3>
            <p className="text-blue-100">
              Round-the-clock customer support for all your dental care needs.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Certified Dentists</h3>
            <p className="text-blue-100">
              All dentists are verified and certified professionals with proven expertise.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">HIPAA Compliant</h3>
            <p className="text-blue-100">
              Your medical data is protected with the highest security standards.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Satisfaction Guaranteed</h3>
            <p className="text-blue-100">
              We ensure quality care and satisfaction with every appointment.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="text-center space-y-6 bg-gray-100 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-gray-900">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Join thousands of patients and dentists who trust our platform for their dental care needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register?role=patient"
              className="btn btn-primary text-lg px-8 py-3"
            >
              Join as Patient
            </Link>
            <Link
              to="/register?role=dentist"
              className="btn btn-secondary text-lg px-8 py-3"
            >
              Join as Dentist
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;

-- Create a trigger to automatically update appointment payment_status when payment status changes

-- Function to update appointment payment status
CREATE OR REPLACE FUNCTION update_appointment_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a payment status is updated to 'completed', update the corresponding appointment
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE appointments 
    SET 
      payment_status = 'paid',
      updated_at = NOW()
    WHERE id = NEW.appointment_id;
    
    -- Log the update
    RAISE NOTICE 'Updated appointment % payment status to paid', NEW.appointment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS payment_status_update_trigger ON payments;
CREATE TRIGGER payment_status_update_trigger
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_payment_status();

-- Also create a trigger for INSERT (in case payment is created as completed)
DROP TRIGGER IF EXISTS payment_insert_trigger ON payments;
CREATE TRIGGER payment_insert_trigger
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointment_payment_status();

-- SAMPLE TECHNICIAN DATA
-- Insert realistic technician profiles for the customer portal

-- Set the tenant context (for RLS)
SET app.current_tenant_id = '10076fd5-e70f-4062-8192-e42173cf57fd';

-- Insert sample technician profiles
INSERT INTO technician_profiles (
    tenant_id,
    user_id,
    display_name,
    title,
    bio,
    photo_url,
    years_experience,
    certifications,
    specialties,
    languages,
    phone_number,
    email,
    show_in_portal,
    show_contact_info,
    rating,
    completed_jobs,
    response_time_minutes,
    is_active,
    emergency_available
) VALUES
-- Mike Rodriguez - Senior HVAC Technician
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    '11111111-1111-1111-1111-111111111111', -- Assuming this user exists
    'Mike Rodriguez',
    'Senior HVAC Technician',
    'With over 12 years in the HVAC industry, Mike specializes in high-efficiency systems and smart home integration. He holds multiple certifications and is known for his attention to detail and customer service excellence.',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face',
    12,
    ARRAY['EPA 608 Certification', 'NATE Certified', 'Nest Pro Installer', 'OSHA 10'],
    ARRAY['HVAC Installation', 'HVAC Repair', 'Smart Thermostats', 'Energy Efficiency'],
    ARRAY['English', 'Spanish'],
    '(555) 123-4567',
    'mike.rodriguez@company.com',
    true,
    true,
    4.9,
    247,
    12,
    true,
    true
),
-- Sarah Chen - Electrical Specialist
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    '11111111-1111-1111-1111-111111111111', -- Assuming this user exists
    'Sarah Chen',
    'Licensed Electrician',
    'Sarah brings 8 years of electrical expertise with a focus on smart home automation and energy-efficient solutions. She excels at complex troubleshooting and safety compliance.',
    'https://images.unsplash.com/photo-1494790108755-2616b612b566?w=300&h=300&fit=crop&crop=face',
    8,
    ARRAY['Master Electrician License', 'Smart Home Professional', 'Energy Star Certified'],
    ARRAY['Electrical Work', 'Smart Home Integration', 'Panel Upgrades', 'LED Lighting'],
    ARRAY['English'],
    '(555) 234-5678',
    'sarah.chen@company.com',
    true,
    true,
    4.8,
    189,
    15,
    true,
    false
),
-- Tom Wilson - Plumbing Expert
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    '11111111-1111-1111-1111-111111111111', -- Assuming this user exists
    'Tom Wilson',
    'Master Plumber',
    'Tom has 15 years of plumbing experience, specializing in water heater systems, leak detection, and energy-efficient upgrades. He is committed to quality workmanship and customer satisfaction.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
    15,
    ARRAY['Master Plumber License', 'Backflow Prevention', 'Water Heater Specialist'],
    ARRAY['Plumbing', 'Water Heaters', 'Leak Detection', 'Pipe Repair'],
    ARRAY['English'],
    '(555) 345-6789',
    'tom.wilson@company.com',
    true,
    true,
    4.7,
    312,
    18,
    true,
    true
),
-- Lisa Park - Smart Systems Specialist
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    '11111111-1111-1111-1111-111111111111', -- Assuming this user exists
    'Lisa Park',
    'Smart Systems Integration Specialist',
    'Lisa specializes in cutting-edge smart home technology and IoT device integration. With 6 years in the field, she helps customers maximize their home automation potential.',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face',
    6,
    ARRAY['Smart Home Professional', 'IoT Certified', 'Network+ Certified'],
    ARRAY['Smart Home Integration', 'IoT Devices', 'Network Setup', 'Home Automation'],
    ARRAY['English', 'Korean'],
    '(555) 456-7890',
    'lisa.park@company.com',
    true,
    true,
    4.9,
    156,
    10,
    true,
    false
),
-- Carlos Martinez - General Service Technician
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    '11111111-1111-1111-1111-111111111111', -- Assuming this user exists
    'Carlos Martinez',
    'Service Technician',
    'Carlos is a versatile technician with experience across multiple trades. He handles appliance repairs, maintenance tasks, and customer support with a friendly, professional approach.',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face',
    5,
    ARRAY['Appliance Repair Certified', 'CPR/First Aid', 'Customer Service Excellence'],
    ARRAY['Appliance Repair', 'Preventive Maintenance', 'Customer Service', 'Emergency Repairs'],
    ARRAY['English', 'Spanish'],
    '(555) 567-8901',
    'carlos.martinez@company.com',
    true,
    true,
    4.6,
    98,
    20,
    true,
    true
);

-- Insert some smart device data connected to equipment
INSERT INTO smart_devices (
    tenant_id,
    contact_id,
    equipment_id,
    device_type,
    device_brand,
    device_model,
    device_id,
    mac_address,
    ip_address,
    capabilities,
    current_settings,
    is_online,
    last_seen,
    firmware_version,
    integration_status
) VALUES
-- Nest Thermostat connected to HVAC system
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM customer_equipment WHERE serial_number = 'NEST-456789'),
    'nest_thermostat',
    'Nest',
    'Learning Thermostat 4th Gen',
    'nest_th_001_johnson',
    '00:1A:2B:3C:4D:5E',
    '192.168.1.100',
    '{"heating": true, "cooling": true, "scheduling": true, "learning": true, "remote_control": true}',
    '{"temperature": 72, "target_temperature": 75, "mode": "cooling", "humidity": 45}',
    true,
    NOW(),
    '6.0.0.23',
    'connected'
),
-- Ring Doorbell as security device
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM customer_equipment WHERE serial_number = 'RING-VDB-001'),
    'ring_doorbell',
    'Ring',
    'Video Doorbell Pro 2',
    'ring_db_001_johnson',
    '00:1A:2B:3C:4D:5F',
    '192.168.1.101',
    '{"video": true, "audio": true, "motion_detection": true, "night_vision": true}',
    '{"battery_level": 87, "motion_detected": false, "recording_enabled": true}',
    true,
    NOW(),
    '3.4.2.1',
    'connected'
);

-- Insert telemetry data for the smart devices
INSERT INTO device_telemetry (
    device_id,
    timestamp,
    metric_name,
    metric_value,
    metric_unit,
    quality_score
) VALUES
-- Nest thermostat telemetry
(
    (SELECT id FROM smart_devices WHERE device_id = 'nest_th_001_johnson'),
    NOW() - INTERVAL '1 hour',
    'temperature',
    72.0,
    'fahrenheit',
    100
),
(
    (SELECT id FROM smart_devices WHERE device_id = 'nest_th_001_johnson'),
    NOW() - INTERVAL '1 hour',
    'target_temperature',
    75.0,
    'fahrenheit',
    100
),
(
    (SELECT id FROM smart_devices WHERE device_id = 'nest_th_001_johnson'),
    NOW() - INTERVAL '1 hour',
    'humidity',
    45.0,
    'percent',
    100
),
-- Ring doorbell telemetry
(
    (SELECT id FROM smart_devices WHERE device_id = 'ring_db_001_johnson'),
    NOW() - INTERVAL '30 minutes',
    'battery_level',
    87.0,
    'percent',
    100
),
(
    (SELECT id FROM smart_devices WHERE device_id = 'ring_db_001_johnson'),
    NOW() - INTERVAL '30 minutes',
    'motion_detected',
    0.0,
    'boolean',
    100
);

-- Insert some additional service quotes for the customer
INSERT INTO service_quotes (
    tenant_id,
    contact_id,
    equipment_id,
    quote_type,
    title,
    description,
    base_price,
    labor_hours,
    material_cost,
    tax_amount,
    total_price,
    member_price,
    member_savings,
    warranty_terms,
    timeline,
    urgency,
    status,
    valid_until
) VALUES
-- Water heater anode rod replacement quote
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM customer_equipment WHERE serial_number = 'RH2020-123456'),
    'repair',
    'Anode Rod Replacement',
    'Replace the anode rod in your water heater to prevent corrosion and extend the life of the tank. Includes inspection of all water heater components.',
    120.00,
    2.0,
    35.00,
    12.40,
    167.40,
    142.29,
    25.11,
    '1 year warranty on parts and labor',
    '2-3 hours',
    'standard',
    'pending',
    CURRENT_DATE + INTERVAL '30 days'
),
-- HVAC system smart upgrade quote
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM customer_equipment WHERE serial_number = 'TR2024-789456'),
    'upgrade',
    'Smart HVAC Monitoring System',
    'Add IoT sensors and smart monitoring to your existing HVAC system. Includes wireless sensors, smart controls, and mobile app integration for real-time monitoring and energy optimization.',
    250.00,
    3.0,
    180.00,
    34.40,
    464.40,
    394.74,
    69.66,
    '3 year warranty on smart components',
    'Same day installation',
    'standard',
    'pending',
    CURRENT_DATE + INTERVAL '45 days'
),
-- Premium service plan quote
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    NULL,
    'maintenance',
    'Upgrade to Total Home Protection Plan',
    'Upgrade from your current Complete Comfort plan to our Total Home Protection plan for ultimate peace of mind. Includes unlimited service visits, 25% discount on repairs, and same-day emergency service.',
    30.00,
    0.0,
    0.00,
    2.40,
    32.40,
    NULL,
    NULL,
    'Cancel anytime, no long-term commitment',
    'Immediate activation',
    'standard',
    'pending',
    CURRENT_DATE + INTERVAL '14 days'
);

-- Verify data insertion
SELECT 'Sample technician and smart device data inserted successfully' as result;

-- Show technician summary
SELECT 
    tp.display_name,
    tp.title,
    tp.years_experience,
    tp.rating,
    tp.completed_jobs,
    CASE WHEN tp.show_in_portal THEN 'Visible' ELSE 'Hidden' END as portal_visibility,
    CASE WHEN tp.is_active THEN 'Active' ELSE 'Inactive' END as status
FROM technician_profiles tp
WHERE tp.tenant_id = '10076fd5-e70f-4062-8192-e42173cf57fd'
ORDER BY tp.years_experience DESC;

-- Show smart devices summary
SELECT 
    sd.device_brand,
    sd.device_model,
    sd.device_type,
    CASE WHEN sd.is_online THEN 'Online' ELSE 'Offline' END as status,
    sd.integration_status,
    ce.name as connected_equipment
FROM smart_devices sd
LEFT JOIN customer_equipment ce ON sd.equipment_id = ce.id
WHERE sd.tenant_id = '10076fd5-e70f-4062-8192-e42173cf57fd'
ORDER BY sd.created_at;

-- Show quotes summary
SELECT 
    sq.title,
    sq.quote_type,
    sq.total_price,
    sq.member_price,
    sq.member_savings,
    sq.status,
    sq.valid_until
FROM service_quotes sq
WHERE sq.tenant_id = '10076fd5-e70f-4062-8192-e42173cf57fd'
AND sq.contact_id = 'b1c2d3e4-f5g6-7890-1234-567890abcdef'
ORDER BY sq.created_at DESC;
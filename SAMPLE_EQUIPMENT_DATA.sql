-- SAMPLE EQUIPMENT DATA
-- Insert realistic equipment for the Johnson Family customer

-- Set the tenant context (for RLS)
SET app.current_tenant_id = '10076fd5-e70f-4062-8192-e42173cf57fd';

-- Insert sample equipment for the Johnson Family
INSERT INTO customer_equipment (
    tenant_id,
    contact_id,
    equipment_type,
    name,
    brand,
    model,
    serial_number,
    install_date,
    warranty_expiration,
    location,
    status,
    efficiency_rating,
    last_service_date,
    next_service_due,
    equipment_image_url,
    notes,
    is_smart_enabled
) VALUES
-- Main HVAC System
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    'hvac',
    'Main HVAC System',
    'Trane',
    'XR16 Heat Pump',
    'TR2024-789456',
    '2019-05-15',
    '2029-05-15',
    'Exterior Unit - East Side',
    'good',
    87,
    '2024-03-15',
    '2024-09-15',
    'https://images.unsplash.com/photo-1581092335878-9c3ab0d6c6d0?w=400&h=300&fit=crop',
    'Recent capacitor replacement. Running efficiently.',
    false
),
-- Smart Thermostat
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    'hvac',
    'Smart Thermostat',
    'Nest',
    'Learning Thermostat (4th Gen)',
    'NEST-456789',
    '2023-01-10',
    '2028-01-10',
    'Main Hallway',
    'excellent',
    95,
    '2024-03-15',
    '2025-03-15',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
    'Wi-Fi connected, learning patterns well',
    true
),
-- Water Heater
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    'plumbing',
    'Water Heater',
    'Rheem',
    'Marathon 50-Gallon Electric',
    'RH2020-123456',
    '2020-08-12',
    '2030-08-12',
    'Garage',
    'needs_attention',
    75,
    '2023-12-05',
    '2024-12-05',
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=300&fit=crop',
    'Anode rod due for replacement soon',
    false
),
-- Electrical Panel
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    'electrical',
    'Main Electrical Panel',
    'Square D',
    '200A Main Breaker Panel',
    'SQD-2020-456',
    '2018-11-20',
    '2038-11-20',
    'Garage Wall',
    'excellent',
    98,
    '2023-08-10',
    '2025-08-10',
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop',
    'All circuits properly labeled and functioning',
    false
),
-- Garage Door Opener
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    'appliance',
    'Garage Door Opener',
    'LiftMaster',
    '8550W Wi-Fi Belt Drive',
    'LM-8550-789',
    '2022-04-05',
    '2027-04-05',
    'Garage Ceiling',
    'good',
    92,
    '2024-01-20',
    '2025-01-20',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
    'Smart features working well, recent belt inspection',
    true
),
-- Ring Doorbell
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    'security',
    'Smart Video Doorbell',
    'Ring',
    'Video Doorbell Pro 2',
    'RING-VDB-001',
    '2023-06-15',
    '2025-06-15',
    'Front Door',
    'excellent',
    94,
    '2024-06-15',
    '2025-06-15',
    'https://images.unsplash.com/photo-1589128777073-263566ae5e4d?w=400&h=300&fit=crop',
    'Motion detection and night vision working perfectly',
    true
);

-- Insert service history for some equipment
INSERT INTO equipment_service_history (
    equipment_id,
    service_date,
    service_type,
    technician_name,
    service_notes,
    labor_hours,
    service_cost
) VALUES
-- HVAC System service history
(
    (SELECT id FROM customer_equipment WHERE serial_number = 'TR2024-789456'),
    '2024-03-15',
    'Spring Maintenance',
    'Mike Rodriguez',
    'Replaced capacitor, cleaned coils, checked refrigerant levels',
    2.5,
    185.00
),
(
    (SELECT id FROM customer_equipment WHERE serial_number = 'TR2024-789456'),
    '2023-09-20',
    'Fall Tune-Up',
    'Sarah Chen',
    'System running well, minor duct sealing completed',
    2.0,
    150.00
),
-- Smart Thermostat service
(
    (SELECT id FROM customer_equipment WHERE serial_number = 'NEST-456789'),
    '2024-03-15',
    'Software Update',
    'Mike Rodriguez',
    'Updated firmware, calibrated sensors',
    0.5,
    75.00
),
-- Water Heater service
(
    (SELECT id FROM customer_equipment WHERE serial_number = 'RH2020-123456'),
    '2023-12-05',
    'Annual Inspection',
    'Tom Wilson',
    'Flushed tank, checked anode rod - replacement recommended within 6 months',
    1.5,
    120.00
),
-- Electrical Panel service
(
    (SELECT id FROM customer_equipment WHERE serial_number = 'SQD-2020-456'),
    '2023-08-10',
    'Safety Inspection',
    'Lisa Park',
    'All breakers tested, panel cleaned, connections tightened',
    1.0,
    95.00
),
-- Garage Door service
(
    (SELECT id FROM customer_equipment WHERE serial_number = 'LM-8550-789'),
    '2024-01-20',
    'Annual Maintenance',
    'Carlos Martinez',
    'Lubricated tracks, tested safety features, calibrated sensors',
    1.5,
    110.00
);

-- Insert AI-generated maintenance recommendations
INSERT INTO maintenance_recommendations (
    tenant_id,
    contact_id,
    equipment_id,
    recommendation_type,
    title,
    description,
    priority,
    estimated_cost,
    estimated_labor_hours,
    timeframe,
    benefits,
    is_ai_generated,
    ai_confidence_score,
    ai_model_version,
    data_sources
) VALUES
-- Water heater anode rod replacement
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM customer_equipment WHERE serial_number = 'RH2020-123456'),
    'repair',
    'Water Heater Anode Rod Replacement',
    'Your water heater''s anode rod is due for replacement based on the last inspection. This preventive maintenance will extend the life of your water heater and maintain efficiency.',
    'medium',
    150.00,
    2.0,
    'next 2 months',
    ARRAY['Prevent tank corrosion', 'Extend equipment life', 'Maintain hot water quality', 'Avoid costly tank replacement'],
    true,
    88,
    'maintenance-ai-v1.0',
    ARRAY['service_history', 'equipment_age', 'manufacturer_guidelines']
),
-- HVAC system smart upgrade
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM customer_equipment WHERE serial_number = 'TR2024-789456'),
    'upgrade',
    'Smart HVAC Monitoring System',
    'Add IoT sensors to your main HVAC system for real-time performance monitoring, energy optimization, and predictive maintenance alerts.',
    'low',
    350.00,
    3.0,
    'next 6 months',
    ARRAY['Real-time performance monitoring', 'Energy savings up to 15%', 'Predictive maintenance alerts', 'Remote diagnostics capability'],
    true,
    82,
    'smart-integration-ai-v1.0',
    ARRAY['equipment_compatibility', 'energy_efficiency_trends']
),
-- Fall HVAC maintenance reminder
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM customer_equipment WHERE serial_number = 'TR2024-789456'),
    'preventive',
    'Fall HVAC Maintenance Due',
    'Your main HVAC system is due for its semi-annual maintenance. Fall tune-ups ensure optimal heating performance and energy efficiency.',
    'medium',
    185.00,
    2.5,
    'next 3 weeks',
    ARRAY['Optimal heating performance', 'Lower energy bills', 'Prevent winter breakdowns', 'Maintain warranty coverage'],
    true,
    92,
    'maintenance-ai-v1.0',
    ARRAY['service_schedule', 'seasonal_requirements']
);

-- Insert a service plan subscription for the customer
INSERT INTO customer_service_plans (
    tenant_id,
    contact_id,
    service_plan_id,
    subscription_status,
    start_date,
    billing_cycle,
    monthly_rate
) VALUES (
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'b1c2d3e4-f5g6-7890-1234-567890abcdef',
    (SELECT id FROM service_plans WHERE plan_name = 'Complete Comfort'),
    'active',
    '2024-01-15',
    'monthly',
    49.00
);

-- Verify data insertion
SELECT 'Sample equipment data inserted successfully' as result;

SELECT 
    ce.name,
    ce.brand,
    ce.model,
    ce.status,
    ce.efficiency_rating,
    COUNT(esh.id) as service_count
FROM customer_equipment ce
LEFT JOIN equipment_service_history esh ON ce.id = esh.equipment_id
WHERE ce.contact_id = 'b1c2d3e4-f5g6-7890-1234-567890abcdef'
GROUP BY ce.id, ce.name, ce.brand, ce.model, ce.status, ce.efficiency_rating
ORDER BY ce.created_at;
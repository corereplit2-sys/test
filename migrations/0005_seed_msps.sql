-- Insert default MSP data
INSERT INTO msps (id, name) VALUES 
('hq', 'HQ'),
('msp1', 'MSP 1'),
('msp2', 'MSP 2'),
('msp3', 'MSP 3'),
('msp4', 'MSP 4'),
('msp5', 'MSP 5')
ON CONFLICT (id) DO NOTHING;

-- Migration: 023_seed_vehicle_service_classes.sql
-- Description: Seeds vehicle_service_classes if the table is empty (fixes vehicles not showing in booking form)

INSERT IGNORE INTO vehicle_service_classes (vehicle_id, service_class) VALUES
(1, 'hourly'), (1, 'airport'), (1, 'event'), (1, 'corporate'),
(2, 'hourly'), (2, 'airport'), (2, 'event'), (2, 'corporate'),
(3, 'hourly'), (3, 'airport'), (3, 'event'), (3, 'corporate'),
(4, 'hourly'), (4, 'airport'), (4, 'event'), (4, 'corporate'),
(5, 'hourly'), (5, 'event'), (5, 'corporate'),
(6, 'hourly'), (6, 'event'), (6, 'corporate'),
(7, 'hourly'), (7, 'event'), (7, 'corporate'),
(8, 'hourly'), (8, 'airport'), (8, 'event'), (8, 'corporate'),
(9, 'hourly'), (9, 'airport'), (9, 'event'), (9, 'corporate'),
(10, 'hourly'), (10, 'event'), (10, 'corporate');

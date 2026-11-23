-- PostgreSQL operational and BI examples. Revenue includes confirmed bookings only.
-- 1. Total bookings by day
SELECT booking_date, count(*) AS bookings FROM bookings GROUP BY booking_date ORDER BY booking_date;
-- 2. Revenue by month
SELECT date_trunc('month', booking_date) AS month, sum(total) AS revenue FROM bookings WHERE status='confirmed' GROUP BY 1 ORDER BY 1;
-- 3. Most popular ticket categories
SELECT t.name, sum(b.quantity) AS tickets FROM bookings b JOIN tickets t ON t.id=b.ticket_id WHERE b.status='confirmed' GROUP BY t.name ORDER BY tickets DESC;
-- 4. Customers with multiple bookings
SELECT c.id,c.name,count(b.id) AS bookings FROM customers c JOIN bookings b ON b.customer_id=c.id GROUP BY c.id,c.name HAVING count(b.id)>1;
-- 5. Cancelled bookings
SELECT * FROM bookings WHERE status='cancelled' ORDER BY booking_date DESC;
-- 6. Average booking value
SELECT avg(total) AS average_booking_value FROM bookings WHERE status='confirmed';
-- 7. Customers with no bookings
SELECT c.* FROM customers c LEFT JOIN bookings b ON b.customer_id=c.id WHERE b.id IS NULL;
-- 8. Ticket sales by category
SELECT t.name,coalesce(sum(b.quantity),0) AS tickets,coalesce(sum(b.total),0) AS revenue FROM tickets t LEFT JOIN bookings b ON b.ticket_id=t.id AND b.status='confirmed' GROUP BY t.id,t.name;
-- BigQuery (substitute your project and dataset)
-- SELECT DATE_TRUNC(booking_date, MONTH) AS month, SUM(total) AS revenue
-- FROM `your-project.museum_analytics.bookings` WHERE status='confirmed' GROUP BY month ORDER BY month;

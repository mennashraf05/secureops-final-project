export const metrics = [
  { label: 'Total Users', value: '1,284', trend: '+12.4%', tone: 'blue' },
  { label: 'Total Products', value: '342', trend: '+5.2%', tone: 'cyan' },
  { label: 'Total Orders', value: '198', trend: '+8.7%', tone: 'violet' },
  { label: 'Failed Logins', value: '27', trend: '-2.1%', tone: 'orange' },
  { label: 'Unauthorized Attempts', value: '12', trend: '+3 today', tone: 'red' },
  { label: 'Processed Jobs', value: '154', trend: '+18.6%', tone: 'green' },
];

export const products = [
  { name: 'Wireless Scanner', sku: 'WS-204', category: 'Hardware', quantity: 86, price: '$129', status: 'In Stock', updated: '2 min ago' },
  { name: 'Secure Badge Reader', sku: 'BR-110', category: 'Security', quantity: 12, price: '$249', status: 'Low Stock', updated: '14 min ago' },
  { name: 'Barcode Printer', sku: 'BP-920', category: 'Hardware', quantity: 0, price: '$319', status: 'Out of Stock', updated: '1 hour ago' },
  { name: 'Inventory Tag Pack', sku: 'IT-501', category: 'Labels', quantity: 420, price: '$29', status: 'In Stock', updated: 'Today' },
  { name: 'Warehouse Sensor Kit', sku: 'SK-77', category: 'IoT', quantity: 42, price: '$499', status: 'In Stock', updated: 'Today' },
  { name: 'Smart Shelf Sensor', sku: 'SS-18', category: 'IoT', quantity: 19, price: '$179', status: 'Low Stock', updated: 'Yesterday' },
];

export const orders = [
  { id: 'ORD-2092', user: 'Mariam Adel', product: 'Wireless Scanner', quantity: 2, status: 'Pending', priority: 'Urgent', date: 'Today', response: 'Waiting review' },
  { id: 'ORD-2088', user: 'Omar Hassan', product: 'Secure Badge Reader', quantity: 1, status: 'Processing', priority: 'High', date: 'Today', response: 'Preparing item' },
  { id: 'ORD-2065', user: 'Nour Samy', product: 'Inventory Tag Pack', quantity: 10, status: 'Completed', priority: 'Normal', date: 'Yesterday', response: 'Delivered' },
  { id: 'ORD-2041', user: 'Yara Ali', product: 'Smart Shelf Sensor', quantity: 4, status: 'Rejected', priority: 'Normal', date: '2 days ago', response: 'Insufficient reason' },
];

export const securityEvents = [
  { event: 'Invalid JWT detected from 192.168.1.44', user: '192.168.1.44', severity: 'Critical', status: 'Open', time: '2 min ago' },
  { event: 'Malicious upload blocked: invoice.exe', user: 'u-291', severity: 'Critical', status: 'Blocked', time: '6 min ago' },
  { event: 'Unauthorized access attempt to /admin/users', user: 'u-102', severity: 'High', status: 'Review', time: '11 min ago' },
  { event: 'Rate limit exceeded for IP 10.10.0.24', user: '10.10.0.24', severity: 'Medium', status: 'Throttled', time: '18 min ago' },
  { event: 'Missing internal API key from worker-service', user: 'worker-service', severity: 'High', status: 'Investigate', time: '22 min ago' },
  { event: 'User attempted to access another user’s order', user: 'u-421', severity: 'High', status: 'Open', time: '31 min ago' },
];

export const auditLogs = [
  { timestamp: '10:42 AM', user: 'admin-1', action: 'Unauthorized Access', ip: '192.168.1.44', status: 'Failed', severity: 'Critical', details: '/admin/users' },
  { timestamp: '10:38 AM', user: 'u-284', action: 'File Download', ip: '10.0.0.15', status: 'Success', severity: 'Low', details: 'policy.pdf' },
  { timestamp: '10:34 AM', user: 'admin-1', action: 'Report Generated', ip: '10.0.0.5', status: 'Success', severity: 'Low', details: 'Audit report' },
  { timestamp: '10:22 AM', user: 'worker-service', action: 'Invalid Internal API Key', ip: 'service-net', status: 'Failed', severity: 'High', details: 'Background job blocked' },
  { timestamp: '10:12 AM', user: 'admin-2', action: 'Order Approval', ip: '10.0.0.9', status: 'Success', severity: 'Low', details: 'ORD-2088' },
];

export const jobs = [
  { id: 'JOB-801', type: 'Inventory Report', requestedBy: 'Admin', status: 'Processing', created: 'Today 10:40', completed: '-', result: 'Pending' },
  { id: 'JOB-799', type: 'Security Report', requestedBy: 'Admin', status: 'Completed', created: 'Today 10:02', completed: 'Today 10:04', result: 'Download' },
  { id: 'JOB-794', type: 'Audit Report', requestedBy: 'Admin', status: 'Failed', created: 'Yesterday', completed: '-', result: 'Retry' },
  { id: 'JOB-786', type: 'Low Stock Report', requestedBy: 'Admin', status: 'Completed', created: 'Yesterday', completed: 'Yesterday', result: 'Download' },
];

export const riskTrend = [
  { name: 'Mon', score: 38, events: 12, orders: 18 },
  { name: 'Tue', score: 45, events: 18, orders: 24 },
  { name: 'Wed', score: 41, events: 14, orders: 19 },
  { name: 'Thu', score: 68, events: 32, orders: 31 },
  { name: 'Fri', score: 56, events: 27, orders: 28 },
  { name: 'Sat', score: 72, events: 39, orders: 22 },
  { name: 'Sun', score: 64, events: 24, orders: 35 },
];

export const simulations = [
  ['Invalid Login', '401', 'High'], ['Missing JWT', '401', 'High'], ['Invalid JWT', '401', 'Critical'], ['Expired JWT', '401', 'Medium'],
  ['User Accessing Admin Endpoint', '403', 'Critical'], ['User Accessing Another User’s Data', '403', 'High'], ['Malicious File Upload', '400', 'Critical'],
  ['Oversized File Upload', '413', 'Medium'], ['Missing Internal API Key', '401', 'High'], ['Rate Limit Exceeded', '429', 'Medium'], ['File Integrity Failure', '409', 'Critical'],
];

export const files = [
  { name: 'Inventory Policy.pdf', type: 'PDF', size: '2.4 MB', by: 'Admin', encryption: 'Encrypted', integrity: 'Verified', date: 'Today' },
  { name: 'Badge Reader Guide.docx', type: 'DOCX', size: '1.1 MB', by: 'Admin', encryption: 'Encrypted', integrity: 'Verified', date: 'Yesterday' },
  { name: 'invoice.exe', type: 'EXE', size: '900 KB', by: 'Blocked', encryption: 'Blocked', integrity: 'Blocked', date: 'Today' },
];

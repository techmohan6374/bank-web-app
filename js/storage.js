/* Central LocalStorage layer. Replace these functions with API calls later. */
const K = {};
['users','customers','accounts','beneficiaries','transactions','notifications','employees','roles','audit_logs','settings','session']
  .forEach(k => K[k] = 'bank_' + k);

function getData(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function saveData(k, d) { localStorage.setItem(k, JSON.stringify(d)); }
function removeData(k) { localStorage.removeItem(k); }
function insertData(k, r) { const a = getData(k) || []; r.id = r.id || generateId(); a.push(r); saveData(k, a); return r; }
function updateData(k, id, p) {
  const a = getData(k) || [], i = a.findIndex(x => x.id === id);
  if (i < 0) return null;
  a[i] = { ...a[i], ...p }; saveData(k, a); return a[i];
}
function deleteData(k, id) { saveData(k, (getData(k) || []).filter(x => x.id !== id)); }
let _seq = 0;
function generateId() { return Date.now().toString(36) + (++_seq).toString(36) + Math.random().toString(36).slice(2, 5); }
function generateTransactionReference() { return 'TXN' + Date.now().toString().slice(-9) + Math.floor(Math.random() * 90 + 10); }

const PERMS = ['View Customers','Manage Customers','View Accounts','Manage Accounts','Transfer Funds','View Transactions',
  'Manage Beneficiaries','View Reports','Manage Employees','Manage Roles','View Audit Logs','Manage Settings'];

function seedData() {
  if (getData(K.users)) return;
  const day = n => new Date(Date.now() - n * 864e5).toISOString();
  const names = ['Aarav Mehta','Diya Nair','Kabir Rao','Isha Menon','Vihaan Shah','Ananya Iyer','Rohan Das','Meera Pillai','Arjun Kapoor','Sana Qureshi'];
  const customers = names.map((n, i) => ({ id: 'c' + (i + 1), code: 'CUST' + (1001 + i), name: n,
    email: n.split(' ')[0].toLowerCase() + '@example.test', phone: '90000000' + (10 + i), status: i === 8 ? 'Suspended' : 'Active', created: day(400 - i * 30) }));
  const types = ['Savings','Current','Salary','Fixed Deposit'];
  const accounts = customers.map((c, i) => { const b = 25000 + i * 18500 + (i % 3) * 40000;
    return { id: 'a' + (i + 1), number: String(500100200300 + i * 111), customerId: c.id, type: types[i % 4], balance: b, available: b - (i % 4 === 3 ? b : 0) * 0,
      status: i === 8 ? 'Suspended' : i === 9 ? 'Pending' : 'Active', created: day(380 - i * 25) }; });
  const banks = ['Demo National Bank','Sample Trust Bank','Example Savings Bank','Fictional Union Bank'];
  const beneficiaries = ['Northwind Supplies','Priya Raman','Lakshmi Traders','Karan Joshi','Greenleaf Realty','Dev Anand','Skyline Utilities','Neha Bose']
    .map((n, i) => ({ id: 'b' + (i + 1), ownerId: i < 4 ? 'c1' : 'c2', name: n, number: String(700800900100 + i * 37),
      bank: banks[i % 4], ifsc: 'DEMO0' + String(100100 + i), nick: n.split(' ')[0], status: i === 6 ? 'Inactive' : 'Active' }));
  const cats = ['Groceries','Utilities','Travel','Dining','Rent','Shopping'], tt = ['Credit','Debit','Transfer'], st = ['Success','Success','Success','Failed','Pending'];
  const transactions = Array.from({ length: 30 }, (_, i) => { const type = tt[i % 3];
    return { id: 't' + (i + 1), reference: 'TXN' + (400000100 + i * 7919), accountId: 'a' + (i % 10 + 1), type,
      amount: 1200 + (i * 3571) % 98000, description: type === 'Credit' ? 'Salary / deposit' : cats[i % 6] + ' payment',
      category: type === 'Credit' ? 'Income' : cats[i % 6], status: st[i % 5], date: day((i * 6) % 170) }; });
  const ntypes = ['Transfer Successful','Transfer Failed','Account Update','Security Alert','System Notification'];
  const notifications = Array.from({ length: 10 }, (_, i) => ({ id: 'n' + (i + 1), type: ntypes[i % 5], title: ntypes[i % 5],
    message: ['Transfer completed to a saved beneficiary.','A transfer could not be completed.','Your account details were updated.','New sign-in detected on your profile.','Scheduled maintenance this weekend.'][i % 5],
    read: i > 6, date: day(i), scope: i % 2 ? 'all' : 'c1' }));
  const employees = ['Rahul Verma:Operations','Tara Singh:Compliance','Imran Khan:Customer Care','Lata Desai:Risk','Vikram Bhat:Operations']
    .map((s, i) => ({ id: 'e' + (i + 1), code: 'EMP' + (201 + i), name: s.split(':')[0], email: 'emp' + (i + 1) + '@bank.demo', dept: s.split(':')[1], role: i === 1 ? 'Administrator' : 'Bank Employee', status: i === 4 ? 'Inactive' : 'Active' }));
  const roles = [
    { id: 'customer', name: 'Customer', perms: ['View Accounts','Transfer Funds','View Transactions','Manage Beneficiaries'] },
    { id: 'employee', name: 'Bank Employee', perms: ['View Customers','Manage Customers','View Accounts','Manage Accounts','View Transactions','View Reports'] },
    { id: 'admin', name: 'Administrator', perms: PERMS.slice() }];
  const acts = [['Login','Authentication'],['Account Created','Accounts'],['Beneficiary Added','Beneficiaries'],['Transfer Completed','Transfers'],['Customer Updated','Customers']];
  const audit = Array.from({ length: 22 }, (_, i) => ({ id: 'l' + (i + 1), user: ['Administrator','Rahul Verma','Aarav Mehta'][i % 3], action: acts[i % 5][0],
    module: acts[i % 5][1], entity: 'REF-' + (3000 + i), timestamp: day(i / 2), details: 'Recorded by demo seed' }));
  saveData(K.customers, customers); saveData(K.accounts, accounts); saveData(K.beneficiaries, beneficiaries);
  saveData(K.transactions, transactions); saveData(K.notifications, notifications); saveData(K.employees, employees);
  saveData(K.roles, roles); saveData(K.audit_logs, audit); saveData(K.settings, { bankName: 'Meridian Digital Bank', transferLimit: 200000 });
  saveData(K.users, [
    { id: 'u1', username: 'customer@bank.demo', password: 'Customer@123', name: 'Aarav Mehta', role: 'customer', customerId: 'c1' },
    { id: 'u2', username: 'employee@bank.demo', password: 'Employee@123', name: 'Rahul Verma', role: 'employee' },
    { id: 'u3', username: 'admin@bank.demo', password: 'Admin@123', name: 'Administrator', role: 'admin' }]);
}

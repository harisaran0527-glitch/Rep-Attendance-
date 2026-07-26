'use client';

import { useState, useEffect } from 'react';
import {
  getAllStudentsWithStats,
  addStudentAction,
  editStudentAction,
  deleteStudentAction,
  addBulkStudentsAction,
  checkUserRoleAction,
} from '@/app/actions';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  UserPlus,
  AlertCircle,
  X,
  Users,
  Upload,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Student {
  id: number;
  registerNumber: string;
  studentName: string;
  email: string;
  department: string;
  year: string;
  section: string;
  percentage?: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [registerNumber, setRegisterNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');

  // Sorting & Pagination States
  const [sortField, setSortField] = useState<'registerNumber' | 'studentName' | 'department' | 'percentage'>('registerNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Delete Confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const roleInfo = await checkUserRoleAction();
      setIsAdmin(roleInfo.isAdmin);
      setIsTeacher(roleInfo.isTeacher);

      const data = await getAllStudentsWithStats();
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const openAddModal = () => {
    setEditingStudent(null);
    setRegisterNumber('');
    setStudentName('');
    setEmail('');
    setPassword('');
    setShowPasswordModal(false);
    setDepartment('');
    setYear('');
    setSection('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setRegisterNumber(student.registerNumber);
    setStudentName(student.studentName);
    setEmail(student.email || '');
    setPassword('');
    setShowPasswordModal(false);
    setDepartment(student.department);
    setYear(student.year);
    setSection(student.section);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);

    const data = {
      registerNumber,
      studentName,
      email,
      password,
      department,
      year,
      section,
    };

    try {
      let result;
      if (editingStudent) {
        result = await editStudentAction(editingStudent.id, data);
      } else {
        result = await addStudentAction(data);
      }

      if (result.success) {
        setIsModalOpen(false);
        fetchStudents();
      } else {
        setModalError(result.error || 'Operation failed.');
      }
    } catch (err) {
      setModalError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await deleteStudentAction(id);
      if (result.success) {
        setDeleteConfirmId(null);
        fetchStudents();
      } else {
        alert(result.error || 'Failed to delete student.');
      }
    } catch (err) {
      alert('Failed to delete student.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet) as any[];

      const studentsList = json.map(row => ({
        registerNumber: String(row['Roll Number'] || row['rollNumber'] || row['Register Number'] || row['registerNumber'] || '').trim(),
        studentName: String(row['Student Name'] || row['studentName'] || '').trim(),
        email: String(row['Email'] || row['email'] || '').trim(),
        password: String(row['Password'] || row['password'] || '').trim(),
        department: String(row['Department'] || row['department'] || '').trim(),
        year: String(row['Year'] || row['year'] || '').trim(),
        section: String(row['Section'] || row['section'] || '').trim(),
      })).filter(s => s.registerNumber && s.studentName);

      if (studentsList.length > 0) {
        const result = await addBulkStudentsAction(studentsList);
        if (result.success) {
          alert(`Successfully added ${result.addedCount} students.`);
          fetchStudents();
        } else {
          alert(result.error || 'Bulk upload failed.');
        }
      } else {
        alert('No valid student data found in the file. Make sure column headers are correct (Roll Number, Student Name, Email, Department, Year, Section).');
      }
    } catch (err) {
      console.error(err);
      alert('Error processing file.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // Client side filtering for instant response
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.registerNumber.toLowerCase().includes(q) ||
      s.studentName.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.year.toLowerCase().includes(q) ||
      s.section.toLowerCase().includes(q)
    );
  });

  // Client side sorting
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];
    
    if (sortField === 'percentage') {
      valA = a.percentage ?? 0;
      valB = b.percentage ?? 0;
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Reset page to 1 when search or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection]);

  // Client side pagination
  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / itemsPerPage));
  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: 'registerNumber' | 'studentName' | 'department' | 'percentage') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search students by roll number, name, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>

        {/* Add button */}
        {!isTeacher && (
          <div className="flex gap-3">
            <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl shadow-lg transition-all text-sm cursor-pointer border border-slate-700">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
              <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/10 transition-all text-sm cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Add Student</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Students List Workspace */}
      <div className="glass rounded-2xl overflow-hidden shadow-xl border border-slate-800">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : sortedStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Users className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-slate-300">No students found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              {searchQuery ? 'Try adjusting your search terms.' : 'Add your first student to get started.'}
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-950/40 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th
                      className="px-6 py-4 cursor-pointer hover:text-slate-200 select-none transition-colors"
                      onClick={() => handleSort('registerNumber')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Roll Number</span>
                        {sortField === 'registerNumber' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:text-slate-200 select-none transition-colors"
                      onClick={() => handleSort('studentName')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Student Name</span>
                        {sortField === 'studentName' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4">Email</th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:text-slate-200 select-none transition-colors"
                      onClick={() => handleSort('department')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Department</span>
                        {sortField === 'department' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4">Year/Sec</th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:text-slate-200 select-none transition-colors"
                      onClick={() => handleSort('percentage')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Attendance</span>
                        {sortField === 'percentage' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                        )}
                      </div>
                    </th>
                    {!isTeacher && <th className="px-6 py-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {paginatedStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-slate-200">
                        {student.registerNumber}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-100">
                        {student.studentName}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{student.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-400">{student.department}</td>
                      <td className="px-6 py-4 text-slate-400">{student.year} - {student.section}</td>
                      <td className="px-6 py-4">
                        {student.percentage !== undefined ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            student.percentage >= 75 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            student.percentage >= 65 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {student.percentage}%
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      {!isTeacher && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => openEditModal(student)}
                              className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-all cursor-pointer"
                              title="Edit Student"
                            >
                              <Edit2 className="w-4.5 h-4.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(student.id)}
                              className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700/50 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {[5, 10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} entries
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 font-medium">
                  Showing {sortedStudents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, sortedStudents.length)} of {sortedStudents.length} students
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pg
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                          : 'bg-slate-900/50 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700/50 hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">
                {editingStudent ? 'Edit Student Details' : 'Add New Student'}
              </h3>
            </div>

            {modalError && (
              <div className="mb-4 flex items-center gap-3 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs">
                <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Roll Number *
                </label>
                <input
                  type="text"
                  required
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  placeholder="e.g. 21CS001"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Student Name *
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password {editingStudent ? '(Leave blank to keep current)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPasswordModal ? 'text' : 'password'}
                    required={!editingStudent}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingStudent ? "••••••••" : "Enter password"}
                    className="block w-full pl-3.5 pr-11 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(!showPasswordModal)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showPasswordModal ? "Hide password" : "Show password"}
                  >
                    {showPasswordModal ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Dept *
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="CSE"
                    className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Year *
                  </label>
                  <input
                    type="text"
                    required
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="III"
                    className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Sec *
                  </label>
                  <input
                    type="text"
                    required
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="A"
                    className="block w-full px-3.5 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Details</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Delete Student?</h3>
            <p className="text-slate-400 text-sm mt-2">
              Are you sure you want to delete this student? All attendance records belonging to this student will also be permanently deleted.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Camera,
  Eye,
  EyeOff,
} from 'lucide-react';
import StudentAvatar from '@/components/StudentAvatar';
import PhotoUploadModal from '@/components/PhotoUploadModal';
import * as XLSX from 'xlsx';

interface Student {
  id: number;
  registerNumber: string;
  studentName: string;
  email: string;
  department: string;
  year: string;
  section: string;
  profilePhotoUrl?: string | null;
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

  // Photo Modal state
  const [photoModalStudent, setPhotoModalStudent] = useState<Student | null>(null);

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
        alert('No valid student data found in the file.');
      }
    } catch (err) {
      console.error(err);
      alert('Error processing file.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection]);

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students by roll number, name, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-4 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
          />
        </div>

        {!isTeacher && (
          <div className="flex gap-3">
            <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 light:bg-slate-200 hover:bg-slate-700 light:hover:bg-slate-300 text-slate-200 light:text-slate-800 font-bold rounded-xl shadow-md transition-all text-xs cursor-pointer border border-slate-700 light:border-slate-300">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
              <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              onClick={openAddModal}
              className="btn-gradient flex items-center justify-center gap-2 px-5 py-2.5 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs cursor-pointer hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Students List Workspace */}
      <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-800 light:border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : sortedStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Users className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-slate-300 light:text-slate-700">No students found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery ? 'Try adjusting your search terms.' : 'Add your first student to get started.'}
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 light:bg-slate-100 border-b border-slate-800 light:border-slate-200 font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600">
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
                <tbody className="divide-y divide-slate-850 light:divide-slate-200">
                  {paginatedStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-800/10 light:hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-indigo-400 light:text-indigo-600">
                        {student.registerNumber}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-100 light:text-slate-900">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPhotoModalStudent(student)}
                            className="relative group shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            title="Manage photo"
                          >
                            <StudentAvatar
                              src={student.profilePhotoUrl}
                              name={student.studentName}
                              size="sm"
                              className="group-hover:opacity-80 transition"
                            />
                          </button>
                          <span>{student.studentName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 light:text-slate-600 text-xs">{student.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-400 light:text-slate-600 font-medium">{student.department}</td>
                      <td className="px-6 py-4 text-slate-400 light:text-slate-600 font-medium">{student.year} - {student.section}</td>
                      <td className="px-6 py-4">
                        {student.percentage !== undefined ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            student.percentage >= 75 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                            'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {student.percentage}%
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      {!isTeacher && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPhotoModalStudent(student)}
                              className="p-2 text-slate-400 hover:text-emerald-400 rounded-xl hover:bg-emerald-500/10 transition-all cursor-pointer"
                              title="Manage Student Photo"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(student)}
                              className="p-2 text-slate-400 hover:text-indigo-400 rounded-xl hover:bg-indigo-500/10 transition-all cursor-pointer"
                              title="Edit Student"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(student.id)}
                              className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash2 className="w-4 h-4" />
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
            <div className="px-6 py-4 bg-slate-950/40 light:bg-slate-100/50 border-t border-slate-800 light:border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-400 light:text-slate-600">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 bg-slate-900 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl text-slate-200 light:text-slate-800 font-bold focus:outline-none cursor-pointer"
                >
                  {[5, 10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} entries
                    </option>
                  ))}
                </select>
                <span>
                  Showing {sortedStudents.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, sortedStudents.length)} of {sortedStudents.length} students
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="px-3 py-1.5 bg-slate-800 light:bg-slate-200 disabled:opacity-50 text-slate-300 light:text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pg
                          ? 'btn-gradient shadow-md text-white'
                          : 'bg-slate-900/50 light:bg-white text-slate-400 light:text-slate-700 hover:text-slate-200 border border-slate-800 light:border-slate-300'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-3 py-1.5 bg-slate-800 light:bg-slate-200 disabled:opacity-50 text-slate-300 light:text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 light:bg-white border border-slate-800 light:border-slate-300 rounded-3xl shadow-2xl p-6 overflow-hidden space-y-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 p-1.5 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100 light:text-slate-900">
                {editingStudent ? 'Edit Student Details' : 'Add New Student'}
              </h3>
            </div>

            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleModalSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Roll Number *
                </label>
                <input
                  type="text"
                  required
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  placeholder="e.g. 21CS001"
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Student Name *
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                  Password {editingStudent ? '(Leave blank to keep current)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPasswordModal ? 'text' : 'password'}
                    required={!editingStudent}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingStudent ? "••••••••" : "Enter password"}
                    className="w-full px-3.5 pr-10 py-2.5 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(!showPasswordModal)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 cursor-pointer"
                  >
                    {showPasswordModal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                    Dept *
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="CSE"
                    className="w-full px-3 py-2 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                    Year *
                  </label>
                  <input
                    type="text"
                    required
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="III"
                    className="w-full px-3 py-2 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 light:text-slate-600 mb-1">
                    Sec *
                  </label>
                  <input
                    type="text"
                    required
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="A"
                    className="w-full px-3 py-2 bg-slate-950/50 light:bg-slate-100 border border-slate-800 light:border-slate-300 rounded-xl text-slate-100 light:text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-700 light:border-slate-300 text-slate-300 light:text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gradient flex-1 py-2.5 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 light:bg-white border border-slate-800 light:border-slate-300 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 light:text-slate-900">Delete Student?</h3>
            <p className="text-slate-400 light:text-slate-600 text-xs leading-relaxed">
              Are you sure you want to delete this student? All attendance records belonging to this student will also be permanently deleted.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 border border-slate-700 light:border-slate-300 text-slate-300 light:text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Photo Upload & Management Modal */}
      {photoModalStudent && (
        <PhotoUploadModal
          isOpen={!!photoModalStudent}
          onClose={() => setPhotoModalStudent(null)}
          studentName={photoModalStudent.studentName}
          currentPhotoUrl={photoModalStudent.profilePhotoUrl}
          studentId={photoModalStudent.id}
          onPhotoUpdated={(newUrl) => {
            setStudents((prev) =>
              prev.map((s) =>
                s.id === photoModalStudent.id ? { ...s, profilePhotoUrl: newUrl } : s
              )
            );
            fetchStudents();
          }}
        />
      )}
    </div>
  );
}

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATTENDANCE_STATUSES = exports.SUBJECTS = void 0;
exports.normalizeDate = normalizeDate;
exports.addStudent = addStudent;
exports.editStudent = editStudent;
exports.deleteStudent = deleteStudent;
exports.getAllStudents = getAllStudents;
exports.searchStudents = searchStudents;
exports.saveAttendance = saveAttendance;
exports.updateAttendance = updateAttendance;
exports.getAttendanceByDate = getAttendanceByDate;
exports.getAttendanceByPeriod = getAttendanceByPeriod;
exports.getStudentAttendanceHistory = getStudentAttendanceHistory;
var db_1 = require("./db");
// Helper to normalize date to local midnight (00:00:00.000)
function normalizeDate(dateInput) {
    var d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
}
// Subject mappings (fixed 5 subjects corresponding to period 1-5)
exports.SUBJECTS = {
    1: 'Java',
    2: 'Data Structures',
    3: 'EDA',
    4: 'Operating Systems (OS)',
    5: 'Discrete Mathematics',
};
// Status list allowed in the application
exports.ATTENDANCE_STATUSES = [
    'Present',
    'Absent',
    'ELITE',
    'On Duty',
    'Medical Leave',
    'Long Leave'
];
// ==========================================
// STUDENTS API
// ==========================================
function addStudent(data) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.prisma.student.create({
                    data: {
                        registerNumber: data.registerNumber.trim(),
                        studentName: data.studentName.trim(),
                        department: data.department.trim(),
                        year: data.year.trim(),
                        section: data.section.trim(),
                    },
                })];
        });
    });
}
function editStudent(id, data) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.prisma.student.update({
                    where: { id: id },
                    data: {
                        registerNumber: data.registerNumber.trim(),
                        studentName: data.studentName.trim(),
                        department: data.department.trim(),
                        year: data.year.trim(),
                        section: data.section.trim(),
                    },
                })];
        });
    });
}
function deleteStudent(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.prisma.student.delete({
                    where: { id: id },
                })];
        });
    });
}
function getAllStudents() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.prisma.student.findMany({
                    orderBy: {
                        registerNumber: 'asc',
                    },
                })];
        });
    });
}
function searchStudents(query) {
    return __awaiter(this, void 0, void 0, function () {
        var cleanQuery;
        return __generator(this, function (_a) {
            cleanQuery = query.trim();
            if (!cleanQuery)
                return [2 /*return*/, getAllStudents()];
            return [2 /*return*/, db_1.prisma.student.findMany({
                    where: {
                        OR: [
                            { registerNumber: { contains: cleanQuery } },
                            { studentName: { contains: cleanQuery } },
                            { department: { contains: cleanQuery } },
                            { year: { contains: cleanQuery } },
                            { section: { contains: cleanQuery } },
                        ],
                    },
                    orderBy: {
                        registerNumber: 'asc',
                    },
                })];
        });
    });
}
// ==========================================
// ATTENDANCE API
// ==========================================
function saveAttendance(studentId, date, period, status) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedDate;
        return __generator(this, function (_a) {
            normalizedDate = normalizeDate(date);
            // If attendance already exists for the same Student, Date, Period, Update the existing record.
            // Never create duplicate attendance. (Upsert using unique index)
            return [2 /*return*/, db_1.prisma.attendance.upsert({
                    where: {
                        studentId_date_period: {
                            studentId: studentId,
                            date: normalizedDate,
                            period: period,
                        },
                    },
                    update: {
                        status: status,
                    },
                    create: {
                        studentId: studentId,
                        date: normalizedDate,
                        period: period,
                        status: status,
                    },
                })];
        });
    });
}
function updateAttendance(id, status) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.prisma.attendance.update({
                    where: { id: id },
                    data: { status: status },
                })];
        });
    });
}
function getAttendanceByDate(date) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedDate;
        return __generator(this, function (_a) {
            normalizedDate = normalizeDate(date);
            return [2 /*return*/, db_1.prisma.attendance.findMany({
                    where: {
                        date: normalizedDate,
                    },
                    include: {
                        student: true,
                    },
                })];
        });
    });
}
function getAttendanceByPeriod(date, period) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedDate;
        return __generator(this, function (_a) {
            normalizedDate = normalizeDate(date);
            return [2 /*return*/, db_1.prisma.attendance.findMany({
                    where: {
                        date: normalizedDate,
                        period: period,
                    },
                    include: {
                        student: true,
                    },
                })];
        });
    });
}
function getStudentAttendanceHistory(studentId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.prisma.attendance.findMany({
                    where: {
                        studentId: studentId,
                    },
                    orderBy: {
                        date: 'desc',
                    },
                })];
        });
    });
}

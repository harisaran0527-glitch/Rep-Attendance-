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
var db_api_1 = require("../src/lib/db-api");
var db_1 = require("../src/lib/db");
function test() {
    return __awaiter(this, void 0, void 0, function () {
        var student1, student2, allStudents, updatedStudent1, searchResults, testDate, att1, att2, att1Updated, allAtt, period1Att, history, studentsAfterDelete;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('--- STARTING DATABASE API TESTS ---');
                    // Clean DB first to avoid constraint issues during tests
                    return [4 /*yield*/, db_1.prisma.attendance.deleteMany()];
                case 1:
                    // Clean DB first to avoid constraint issues during tests
                    _a.sent();
                    return [4 /*yield*/, db_1.prisma.student.deleteMany()];
                case 2:
                    _a.sent();
                    // 1. Add Student
                    console.log('Adding students...');
                    return [4 /*yield*/, (0, db_api_1.addStudent)({
                            registerNumber: 'REG001',
                            studentName: 'Alice Johnson',
                            department: 'CSE',
                            year: 'III',
                            section: 'A',
                        })];
                case 3:
                    student1 = _a.sent();
                    console.log('Added Student 1:', student1.studentName);
                    return [4 /*yield*/, (0, db_api_1.addStudent)({
                            registerNumber: 'REG002',
                            studentName: 'Bob Smith',
                            department: 'CSE',
                            year: 'III',
                            section: 'B',
                        })];
                case 4:
                    student2 = _a.sent();
                    console.log('Added Student 2:', student2.studentName);
                    return [4 /*yield*/, (0, db_api_1.getAllStudents)()];
                case 5:
                    allStudents = _a.sent();
                    console.log('All students count:', allStudents.length);
                    if (allStudents.length !== 2)
                        throw new Error('Expected 2 students');
                    // 3. Edit Student
                    console.log('Editing student 1...');
                    return [4 /*yield*/, (0, db_api_1.editStudent)(student1.id, {
                            registerNumber: 'REG001',
                            studentName: 'Alice J. Miller',
                            department: 'CSE',
                            year: 'III',
                            section: 'A',
                        })];
                case 6:
                    updatedStudent1 = _a.sent();
                    console.log('Updated Student 1 Name:', updatedStudent1.studentName);
                    if (updatedStudent1.studentName !== 'Alice J. Miller') {
                        throw new Error('Edit student failed');
                    }
                    // 4. Search Students
                    console.log('Searching students for "Miller"...');
                    return [4 /*yield*/, (0, db_api_1.searchStudents)('Miller')];
                case 7:
                    searchResults = _a.sent();
                    console.log('Search results count:', searchResults.length);
                    if (searchResults.length !== 1 || searchResults[0].id !== student1.id) {
                        throw new Error('Search failed');
                    }
                    // 5. Save Attendance
                    console.log('Saving attendance...');
                    testDate = new Date('2026-07-20');
                    return [4 /*yield*/, (0, db_api_1.saveAttendance)(student1.id, testDate, 1, 'Present')];
                case 8:
                    att1 = _a.sent();
                    console.log("Saved Attendance for ".concat(student1.studentName, ": Period 1 -> ").concat(att1.status));
                    return [4 /*yield*/, (0, db_api_1.saveAttendance)(student2.id, testDate, 1, 'Absent')];
                case 9:
                    att2 = _a.sent();
                    console.log("Saved Attendance for ".concat(student2.studentName, ": Period 1 -> ").concat(att2.status));
                    // 6. Test Upsert (Save attendance again for Alice, Period 1 with status ELITE)
                    console.log('Testing Upsert (changing Alice to ELITE)...');
                    return [4 /*yield*/, (0, db_api_1.saveAttendance)(student1.id, testDate, 1, 'ELITE')];
                case 10:
                    att1Updated = _a.sent();
                    console.log("Updated Attendance for ".concat(student1.studentName, ": Period 1 -> ").concat(att1Updated.status));
                    if (att1Updated.status !== 'ELITE') {
                        throw new Error('Upsert status update failed');
                    }
                    return [4 /*yield*/, (0, db_api_1.getAttendanceByDate)(testDate)];
                case 11:
                    allAtt = _a.sent();
                    console.log("Total attendance records on ".concat(testDate.toDateString(), ":"), allAtt.length);
                    if (allAtt.length !== 2) {
                        throw new Error("Expected 2 records, got ".concat(allAtt.length, ". Duplicates were likely created!"));
                    }
                    // 7. Get Attendance By Period
                    console.log('Getting attendance for Period 1...');
                    return [4 /*yield*/, (0, db_api_1.getAttendanceByPeriod)(testDate, 1)];
                case 12:
                    period1Att = _a.sent();
                    console.log('Period 1 records count:', period1Att.length);
                    if (period1Att.length !== 2)
                        throw new Error('Expected 2 records for Period 1');
                    // 8. Get History
                    console.log("Getting history for Alice (ID: ".concat(student1.id, ")..."));
                    return [4 /*yield*/, (0, db_api_1.getStudentAttendanceHistory)(student1.id)];
                case 13:
                    history = _a.sent();
                    console.log('Alice history count:', history.length);
                    if (history.length !== 1 || history[0].status !== 'ELITE') {
                        throw new Error('History fetch or status failed');
                    }
                    // 9. Delete Student
                    console.log('Deleting student 2...');
                    return [4 /*yield*/, (0, db_api_1.deleteStudent)(student2.id)];
                case 14:
                    _a.sent();
                    return [4 /*yield*/, (0, db_api_1.getAllStudents)()];
                case 15:
                    studentsAfterDelete = _a.sent();
                    console.log('Students count after delete:', studentsAfterDelete.length);
                    if (studentsAfterDelete.length !== 1)
                        throw new Error('Delete failed');
                    console.log('--- ALL DATABASE API TESTS PASSED SUCCESSFULLY! ---');
                    return [2 /*return*/];
            }
        });
    });
}
test()
    .catch(function (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, db_1.prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });

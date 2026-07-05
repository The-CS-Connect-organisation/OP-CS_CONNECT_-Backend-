import { Request, Response, Router } from 'express';
import { listData, getData } from '../firebase';
import { startOfMonth, endOfMonth } from 'date-fns';

const router = Router();

// GET /api/analytics/admin
router.get('/admin', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!['admin', 'principal'].includes(requester?.role)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }

        const users = await listData('users');
        const attendanceRecords = await listData('attendanceRecords');
        const feeRecords = await listData('feeRecords');
        const payrollRecords = await listData('payrollRecords');
        const assignments = await listData('assignments');

        const today = new Date();
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);

        // User stats
        const studentCount = users.filter(u => u.role === 'student').length;
        const teacherCount = users.filter(u => u.role === 'teacher').length;
        const activeUsers = users.filter(u => u.lastLogin && new Date(u.lastLogin) > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)).length;

        // Attendance stats
        const totalAttendance = attendanceRecords.length;
        const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
        const overallAttendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

        // Financial stats for the current month
        const monthlyFeesCollected = feeRecords
            .filter(f => f.status === 'paid' && new Date(f.paymentDate) >= monthStart && new Date(f.paymentDate) <= monthEnd)
            .reduce((sum, f) => sum + f.amount, 0);
        const monthlyPayrollPaid = payrollRecords
            .filter(p => p.status === 'paid' && new Date(p.paymentDate) >= monthStart && new Date(p.paymentDate) <= monthEnd)
            .reduce((sum, p) => sum + p.netSalary, 0);

        // Academic stats
        const assignmentsPublished = assignments.length;
        const submissions = await listData('submissions');
        const totalSubmissions = submissions.length;

        res.json({
            success: true,
            analytics: {
                users: {
                    totalStudents: studentCount,
                    totalTeachers: teacherCount,
                    totalUsers: users.length,
                    weeklyActiveUsers: activeUsers,
                },
                attendance: {
                    overallAttendanceRate: overallAttendanceRate.toFixed(2),
                    totalRecords: totalAttendance,
                },
                finance: {
                    currentMonthFees: monthlyFeesCollected,
                    currentMonthPayroll: monthlyPayrollPaid,
                    netIncome: monthlyFeesCollected - monthlyPayrollPaid,
                },
                academics: {
                    totalAssignments: assignmentsPublished,
                    totalSubmissions: totalSubmissions,
                }
            }
        });

    } catch (err) {
        console.error('[Analytics] Admin dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/analytics/teacher
router.get('/teacher', async (req: Request, res: Response) => {
    try {
        const teacherId = req.headers['x-user-id'] as string;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const teacher = await getData(`users/${teacherId}`);
        if (teacher?.role !== 'teacher') {
            return res.status(403).json({ error: 'Forbidden - Only teachers can access this' });
        }

        const assignments = await listData('assignments');
        const submissions = await listData('submissions');
        const gradeRecords = await listData('gradeRecords');
        const users = await listData('users');

        const teacherAssignments = assignments.filter(a => a.teacherId === teacherId);
        const teacherAssignmentIds = teacherAssignments.map(a => a.id);

        // Get all students taught by this teacher
        const teacherClasses = [...new Set(teacherAssignments.map(a => a.classId))];
        const myStudents = users.filter(u => teacherClasses.includes(u.classId));
        const myStudentIds = myStudents.map(s => s.id);

        // Submission stats
        const relevantSubmissions = submissions.filter(s => teacherAssignmentIds.includes(s.assignmentId));
        const submissionRate = myStudents.length > 0 && teacherAssignments.length > 0
            ? (relevantSubmissions.length / (myStudents.length * teacherAssignments.length)) * 100
            : 0;

        // Grading stats
        const gradedSubmissions = relevantSubmissions.filter(s => s.isGraded).length;
        const gradingRate = relevantSubmissions.length > 0 ? (gradedSubmissions / relevantSubmissions.length) * 100 : 0;

        // Performance stats
        const relevantGrades = gradeRecords.filter(g => myStudentIds.includes(g.studentId) && teacherAssignmentIds.includes(g.assignmentId));
        const averageScore = relevantGrades.length > 0
            ? relevantGrades.reduce((sum, g) => sum + g.percentage, 0) / relevantGrades.length
            : 0;

        res.json({
            success: true,
            analytics: {
                assignments: {
                    published: teacherAssignments.length,
                    totalSubmissions: relevantSubmissions.length,
                    submissionRate: submissionRate.toFixed(2) + '%',
                },
                grading: {
                    gradedSubmissions: gradedSubmissions,
                    gradingRate: gradingRate.toFixed(2) + '%',
                },
                performance: {
                    classAverage: averageScore.toFixed(2) + '%',
                    totalGradesGiven: relevantGrades.length,
                }
            }
        });

    } catch (err) {
        console.error('[Analytics] Teacher dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// GET /api/analytics/manager/finance
router.get('/manager/finance', async (req: Request, res: Response) => {
    try {
        const feesData = await listData('fees') as any;
        let totalCollected = 0;
        let totalOutstanding = 0;
        if (feesData) {
            for (const studentFees of feesData) {
                const feeList = Object.values(studentFees) as any[];
                for (const f of feeList) {
                    totalCollected += f.paid || 0;
                    totalOutstanding += (f.amount || 0) - (f.paid || 0);
                }
            }
        }

        const expensesArr = await listData('expenses');
        const expenses = expensesArr.reduce((s: number, e: any) => s + (e.amount || 0), 0);

        const payslipsArr = await listData('payslips');
        const payroll = payslipsArr.reduce((s: number, p: any) => s + (p.amount || 0), 0);

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};

        for (const e of expensesArr) {
            if (e.date) {
                const m = monthNames[new Date(e.date).getMonth()] || 'Unknown';
                if (!monthlyMap[m]) monthlyMap[m] = { revenue: 0, expenses: 0 };
                monthlyMap[m].expenses += e.amount || 0;
            }
        }

        monthlyMap['Jan'] = { revenue: 0, expenses: 0 };
        if (feesData) {
            for (const studentFees of feesData) {
                for (const f of Object.values(studentFees) as any[]) {
                    if (f.paid) monthlyMap['Jan'].revenue += f.paid;
                }
            }
        }

        const monthlyTrend = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

        res.json({
            success: true,
            revenue: totalCollected,
            expenses,
            profit: totalCollected - expenses,
            feeCollection: { collected: totalCollected, pending: totalOutstanding },
            payroll,
            monthlyTrend,
        });

    } catch (err) {
        console.error('[Analytics] Finance dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/analytics/class/:id
router.get('/class/:id', async (req: Request, res: Response) => {
    try {
        const classId = req.params.id;
        const users = await listData('users');
        const students = users.filter((u: any) => u.role === 'student' && (u.classId === classId || u.class === classId));
        
        // Mocked response for now since we don't have grades hooked up fully yet
        const analytics = {
            classAverage: 85,
            topScore: 98,
            atRiskCount: students.length > 5 ? 2 : 0,
            complianceScore: 92,
            totalStudents: students.length,
            attendanceRate: 94
        };
        
        res.json({ success: true, analytics });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
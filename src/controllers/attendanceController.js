const Attendance = require('../models/Attendance');

exports.checkIn = async (req, res) => {
    try {
        const userId = req.user.id;
        const attendance = await Attendance.checkIn(userId);
        res.status(201).json({
            success: true,
            data: attendance
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.checkOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const attendance = await Attendance.checkOut(userId);
        res.status(200).json({
            success: true,
            data: attendance
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const status = await Attendance.getTodayStatus(userId);
        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getTodayAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.getAllToday();
        res.status(200).json({
            success: true,
            data: attendance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAttendanceRecords = async (req, res) => {
    try {
        const { date, employeeName } = req.query;
        const records = await Attendance.getRecords({ date, employeeName });
        res.status(200).json({
            success: true,
            data: records
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

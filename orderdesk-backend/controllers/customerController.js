import mongoose from "mongoose";
import Customer from "../models/Customer.js";

const allowedFields = [
  "name",
  "phone",
  "email",
  "address",
  "city",
  "notes",
];

const getCustomerData = (body) => {
  const data = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(body, field)) {
      data[field] = body[field];
    }
  }

  return data;
};

// CREATE CUSTOMER
export const createCustomer = async (req, res) => {
  try {
    const data = getCustomerData(req.body);

    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      typeof data.phone !== "string" ||
      !data.phone.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer name and phone are required",
      });
    }

    const customer = await Customer.create({
      ...data,
      userId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET ALL CUSTOMERS
export const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error("Get customers error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET SINGLE CUSTOMER
export const getCustomerById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Get customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE CUSTOMER
export const updateCustomer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const data = getCustomerData(req.body);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update",
      });
    }

    if (
      ("name" in data &&
        (typeof data.name !== "string" || !data.name.trim())) ||
      ("phone" in data &&
        (typeof data.phone !== "string" || !data.phone.trim()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Name and phone cannot be empty",
      });
    }

    const customer = await Customer.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      { $set: data },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE CUSTOMER
export const deleteCustomer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Delete customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
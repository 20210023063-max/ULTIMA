const { BRANCHES } = require("../constants/branches");

const ESTAR_FEE = 150;
const CARWASH_FEE = 200;
const VAT_RATE = 0.12;

function rentalDaysInclusive(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const ms = Math.max(0, b - a);
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

function buildInvoice(rental) {
  const days = rentalDaysInclusive(rental.rentalDate, rental.returnDate);
  const rentalTotal = rental.rentalRateSnapshot * days;
  const subtotal = rentalTotal + ESTAR_FEE + CARWASH_FEE;
  const vat = subtotal * VAT_RATE;
  const totalAmount = subtotal + vat;
  const branchName = BRANCHES[rental.branch] || rental.branch;

  const lines = [
    "==============================================",
    "                 OFFICIAL RECEIPT              ",
    "==============================================",
    "",
    `Branch: ${branchName}`,
    `OR No: OR-${rental.rentalId}`,
    `Date Issued: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Payment: ${rental.paymentStatus === "paid" ? "PAID" : "PENDING"}`,
    "",
    `Received From: ${rental.customerName}`,
    `Email: ${rental.customerEmail}`,
    "",
    "Address: ________________________________",
    "Contact No: _____________________________",
    "",
    "==============================================",
    "               TRANSACTION DETAILS             ",
    "==============================================",
    `Vehicle: ${rental.vehicleModel}`,
    `Vehicle ID: ${rental.vehicleId}`,
    `Rental Date: ${new Date(rental.rentalDate).toISOString().slice(0, 10)}`,
    `Return Date: ${new Date(rental.returnDate).toISOString().slice(0, 10)}`,
    `Days Rented: ${days}`,
    "",
    `${String("Rate per Day x " + days).padEnd(25)} ₱${rentalTotal.toFixed(2)}`,
    `${"Carwash Fee".padEnd(25)} ₱${CARWASH_FEE.toFixed(2)}`,
    `${"Other fees".padEnd(25)} ₱${ESTAR_FEE.toFixed(2)}`,
    "----------------------------------------------",
    `${"SUBTOTAL".padEnd(25)} ₱${subtotal.toFixed(2)}`,
    `${"VAT (12%)".padEnd(25)} ₱${vat.toFixed(2)}`,
    "----------------------------------------------",
    `${"TOTAL AMOUNT DUE".padEnd(25)} ₱${totalAmount.toFixed(2)}`,
    "==============================================",
    "",
    "Received By: ________________________________",
    "Customer Signature: _________________________",
    "",
    "THIS SERVES AS AN OFFICIAL RECEIPT",
    "Thank you for choosing our service!",
  ];

  return {
    branch: rental.branch,
    branchName,
    rentalId: rental.rentalId,
    plainText: lines.join("\n"),
    totals: {
      days,
      rentalTotal,
      estarFee: ESTAR_FEE,
      carwashFee: CARWASH_FEE,
      subtotal,
      vat,
      totalAmount,
      paymentStatus: rental.paymentStatus,
    },
  };
}

module.exports = { buildInvoice, rentalDaysInclusive, ESTAR_FEE, CARWASH_FEE, VAT_RATE };

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const port = 3000;

// MySQL connection configuration
const db = mysql.createConnection({
    host: '89.117.188.154',
    user: 'u786034410_backend',
    password: 'Backend@123',
    database: 'u786034410_backend'
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

app.use(bodyParser.json());

// Endpoint to register a new customer
app.post('/register', (req, res) => {
    const { first_name, last_name,  monthly_salary, phone_number } = req.body;

    // Calculate approved limit
    const approved_limit = Math.round(36 * (monthly_salary / 100000));

    // Create new customer
    const newCustomer = {
        first_name,
        last_name,
        phone_number,
        monthly_salary,
        approved_limit,
        current_debt: 0  // Assuming initial debt is 0
    };

    // Add the new customer to the MySQL database
    db.query('INSERT INTO customer_data SET ?', newCustomer, (err, result) => {
        if (err) {
            console.error('Error inserting new customer into MySQL:', err);
            res.status(500).send('Internal Server Error');
        } else {
            console.log('New customer inserted into MySQL');
            res.json(newCustomer);
        }
    });
});

// Endpoint to check loan eligibility
app.post('/check-eligibility', (req, res) => {
    const { customer_id, loan_amount, interest_rate, tenure, monthly_salary } = req.body;

    // Fetch data of the customer from the 'customer_data' table
    db.query('SELECT * FROM customer_data WHERE customer_id = ?', [customer_id], (err, rows) => {
        if (err) {
            console.error('Error fetching customer data:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (rows.length === 0) {
            res.status(404).send('Customer not found');
            return;
        }

        // Extract necessary data for credit score calculation
        const customerData = rows[0];
        const { past_loans_paid_on_time, no_of_loans_taken, loan_activity_current_year, loan_approved_volume, current_debt, approved_limit } = customerData;

        // Credit score calculation based on provided criteria
        let creditScore = 0;

        if (past_loans_paid_on_time) {
            creditScore += 20;
        }

        creditScore += Math.min(no_of_loans_taken, 5) * 10;

        if (loan_activity_current_year === 'high') {
            creditScore += 20;
        } else if (loan_activity_current_year === 'medium') {
            creditScore += 10;
        }

        if (current_debt <= approved_limit) {
            creditScore += 30;
        } else {
            creditScore = 0; // If the current debt exceeds the approved limit, set credit score to 0
        }

        // Check sum of all current EMIs > 50% of monthly salary
        const sumCurrentEMIs = 0; // Calculate the sum of current EMIs, if applicable

        if (sumCurrentEMIs > monthly_salary * 0.5) {
            creditScore = 0; // If sum of all current EMIs > 50% of monthly salary, set credit score to 0
        }

        // Assign loan approval and interest rate based on credit score
        let approval = false;
        let correctedInterestRate = interest_rate;

        if (creditScore > 50) {
            approval = true;
        } else if (creditScore > 30) {
            if (interest_rate > 12) {
                correctedInterestRate = 12;
            }
            approval = true;
        } else if (creditScore > 10) {
            if (interest_rate > 16) {
                correctedInterestRate = 16;
            }
            approval = true;
        }

        // Prepare and send the response
        const response = {
            customer_id,
            approval,
            interest_rate,
            corrected_interest_rate: correctedInterestRate,
            tenure,
            monthly_installment: (loan_amount * correctedInterestRate) / tenure // Calculate monthly installment based on corrected interest rate
        };

        res.json(response);
    });
});

app.post('/create-loan', (req, res) => {
    const { customer_id, loan_amount, interest_rate, tenure } = req.body;

    // Fetch customer details from the database
    db.query('SELECT * FROM customer_data WHERE customer_id = ?', [customer_id], (err, rows) => {
        if (err) {
            console.error('Error fetching customer data:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (rows.length === 0) {
            res.json({
                loan_id: 1,
                customer_id,
                loan_approved: false,
                message: 'Customer not found'
            });
            return;
        }

        // Implement the credit score calculation and loan eligibility logic as before
        // Assuming credit score calculation is performed here using the fetched customer data
        // Calculate credit score and determine loan approval based on the criteria

        // Example credit score calculation and loan approval logic
        let approval = false;
        let message = '';
        let loan_id = null;

        const creditScore = 60; // Example credit score for demonstration purposes

        if (creditScore > 50) {
            approval = true;
        } else if (creditScore > 30) {
            if (interest_rate > 12) {
                interest_rate = 12;
            }
            approval = true;
        } // Add more conditions as per your requirements

        if (!approval) {
            message = 'Loan not approved due to low credit score';
        } else {
            // Insert the approved loan into the 'loans' table and get the loan_id
            const newLoan = { customer_id, loan_amount, interest_rate, tenure };
            db.query('INSERT INTO loans SET ?', newLoan, (err, result) => {
                if (err) {
                    console.error('Error creating new loan:', err);
                    res.status(500).send('Internal Server Error');
                    return;
                }

                loan_id = result.insertId;
            });
        }

        res.json({
            loan_id,
            customer_id,
            loan_approved: approval,
            message,
            monthly_installment: (loan_amount * interest_rate) / tenure
        });
    });
});

// View loan details and customer details
app.get('/view-loan/:loan_id', (req, res) => {
    const loanId = req.params.loan_id;

    // Fetch loan details and customer details from the database based on loan_id
    db.query('SELECT * FROM loans WHERE loan_id = ?', [loanId], (err, loanRows) => {
        if (err) {
            console.error('Error fetching loan details:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (loanRows.length === 0) {
            res.status(404).send('Loan not found');
            return;
        }

        const loanDetails = loanRows[0];

        // Fetch customer details based on customer_id from the fetched loan details
        db.query('SELECT id, first_name, last_name, phone_number, age FROM customers WHERE id = ?', [loanDetails.customer_id], (err, customerRows) => {
            if (err) {
                console.error('Error fetching customer details:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            if (customerRows.length === 0) {
                res.status(404).send('Customer not found');
                return;
            }

            const customerDetails = customerRows[0];

            // Prepare and send the response
            const response = {
                loan_id: loanDetails.loan_id,
                customer: {
                    id: customerDetails.id,
                    first_name: customerDetails.first_name,
                    last_name: customerDetails.last_name,
                    phone_number: customerDetails.phone_number,
                    age: customerDetails.age
                },
                loan_amount: loanDetails.loan_amount,
                interest_rate: loanDetails.interest_rate,
                monthly_installment: loanDetails.monthly_installment,
                tenure: loanDetails.tenure
            };

            res.json(response);
        });
    });
});

// Make a payment towards an EMI
app.post('/make-payment/:customer_id/:loan_id', (req, res) => {
    // Handle payment logic for a specific customer's loan here
    // Recalculate EMI amount if needed
    // Perform appropriate error handling
    // Not provided in this example due to complexity

    res.send('Payment received'); // Placeholder response
});

// View statement of a particular loan taken by the customer
app.get('/view-statement/:customer_id/:loan_id', (req, res) => {
    const customerId = req.params.customer_id;
    const loanId = req.params.loan_id;

    // Fetch loan statement details from the database based on customer_id and loan_id
    db.query('SELECT * FROM loan_statements WHERE customer_id = ? AND loan_id = ?', [customerId, loanId], (err, statementRows) => {
        if (err) {
            console.error('Error fetching loan statement:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (statementRows.length === 0) {
            res.status(404).send('Loan statement not found');
            return;
        }

        // Prepare and send the response with the list of loan items
        const loanItems = statementRows.map(row => ({
            customer_id: row.customer_id,
            loan_id: row.loan_id,
            principal: row.principal,
            interest_rate: row.interest_rate,
            amount_paid: row.amount_paid,
            monthly_installment: row.monthly_installment,
            repayments_left: row.repayments_left
        }));

        res.json(loanItems);
    });
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

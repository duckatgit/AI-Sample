const adminController = require("./adminController");

// Custom matcher to check if an object contains exactly the specified keys
expect.extend({
    toHaveExactKeys(received, expectedKeys) {
        const receivedKeys = Object.keys(received);
        const missingKeys = expectedKeys.filter(key => !receivedKeys.includes(key));
        const extraKeys = receivedKeys.filter(key => !expectedKeys.includes(key));
        const pass = missingKeys.length === 0 && extraKeys.length === 0;
        if (pass) {
            return {
                message: () =>
                    `expected object to not have exactly the specified keys: ${extraKeys.join(', ')}`,
                pass: true,
            };
        } else {
            return {
                message: () =>
                    `expected object to have exactly the specified keys: ${missingKeys.join(', ')}`,
                pass: false,
            };
        }
    },
});

// Function to generate a random email address
function generateRandomString() {
    return Math.random().toString(36).substring(7);
}

function generateRandomPhoneNumber() {
    let phoneNumber = '+';
    for (let i = 0; i < 12; i++) {
        phoneNumber += Math.floor(Math.random() * 10);
    }
    return phoneNumber;
}

async function organisation_admin_signup_test() {

    const email = `${generateRandomString()}@example.com`;
    const password = generateRandomString();
    const phone = generateRandomPhoneNumber();

    // Mock the request object
    const req = {
        body: {
            email,
            password,
            phone
        }
    };

    // Mock the response object with jest.fn()
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };

    const otp = await adminController.organisation_signup(req, res);
    
    // Extract the response body
    const responseBody = res.json.mock.calls[0][0].body;

    // Assert that res.status was called with 200
    expect(res.status).toHaveBeenCalledWith(200);

    // Validate the response structure and types
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        code: 200,
        message: expect.any(String),
        body: expect.objectContaining({
            admin_id: expect.any(Number),
            chat_id: expect.any(String),
            createdAt: expect.any(Date), // Assuming createdAt is a Date object
            email: expect.any(String),
            first_name: expect.any(String),
            forgotPasswordHash: expect.any(String),
            id: expect.any(Number),
            is_block: expect.any(Number),
            is_verified: expect.any(Number),
            last_name: expect.any(String),
            name: expect.any(String),
            org_id: expect.any(Number),
            password: expect.any(String),
            phone: expect.any(String),
            role: expect.any(Number),
            updatedAt: expect.any(Date), // Assuming updatedAt is a Date object
        }),
    }));

    // Validate the exact keys in the body
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.toHaveExactKeys([
            'admin_id',
            'chat_id',
            'createdAt',
            'email',
            'first_name',
            'forgotPasswordHash',
            'id',
            'is_block',
            'is_verified',
            'last_name',
            'name',
            'org_id',
            'password',
            'phone',
            'role',
            'updatedAt',
        ]),
    }));

    return { email, password, otp, getOrg: responseBody };
}

async function organisation_admin_confirm_otp_test(id, otp) {
    // Mock the response object with jest.fn()
    const res2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };

    // Mock the request object
    const req2 = {
        body: {
            id,
            otp
        }
    };

    await adminController.confirm_otp(req2, res2);

    // Define the expected response structure
    const expectedResponse = {
        success: true,
        code: 200,
        message: "otp matched",
        body: expect.objectContaining({
            id: expect.any(Number),
            role: expect.any(Number),
            admin_id: expect.any(Number),
            otp: expect.any(Number),
            is_verified: expect.any(Number),
            org_id: expect.any(Number),
            is_block: expect.any(Number),
            password: expect.any(String),
            name: expect.any(String),
            first_name: expect.any(String),
            last_name: expect.any(String),
            email: expect.any(String),
            forgotPasswordHash: expect.any(String),
            chat_id: expect.any(String),
            phone: expect.any(String),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            token: expect.any(String),
        }),
    };

    // Validate the response
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining(expectedResponse));
}

async function organisation_admin_login_test(email, password) {
    // Mock the response object with jest.fn()
    const res3 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };

    // Mock the request object
    const req3 = {
        body: {
            email,
            password
        }
    };


    // Call the function to be tested
    await adminController.login(req3, res3);

    // Validate the exact keys in the body
    expect(res3.json).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.toHaveExactKeys([
            'admin_id',
            'chat_id',
            'createdAt',
            'email',
            'first_name',
            'forgotPasswordHash',
            'id',
            'is_block',
            'is_verified',
            'last_name',
            'name',
            'org_id',
            'otp',
            'phone',
            'role',
            'token',
            'updatedAt',
        ]),
    }));

    // Define the expected response structure
    const expectedResponse3 = {
        success: true,
        code: 200,
        message: "Login Successfull!",
        body: {
            admin_id: 0,
            chat_id: "",
            createdAt: expect.any(Date),
            email: expect.any(String),
            first_name: "",
            forgotPasswordHash: "",
            id: expect.any(Number),
            is_block: 0,
            is_verified: 1,
            last_name: "",
            name: "",
            org_id: 0,
            otp: 0,
            phone: expect.any(String),
            role: 5,
            token: expect.any(String),
            updatedAt: expect.any(Date),
        },
    };


    // Validate the response
    expect(res3.json).toHaveBeenCalledWith(expect.objectContaining(expectedResponse3));
}

describe('Admin controller test', () => {
    it('org admin signup should respond with the correct status and json structure', async () => {
        const { email, password, otp, getOrg } = await organisation_admin_signup_test();
    });

    it('org admin signup should confirm with otp', async () => {
        const { email, password, otp, getOrg } = await organisation_admin_signup_test();
        await organisation_admin_confirm_otp_test(getOrg.id, otp);
    });

    it('org admin login should work after confirming otp', async () => {
        const { email, password, otp, getOrg } = await organisation_admin_signup_test();
        await organisation_admin_confirm_otp_test(getOrg.id, otp);
        await organisation_admin_login_test(email, password);
    });
});

/*
admin/add_organisation

req

account_type
: 
"1"
address
: 
"asdasd"
name
: 
"asdsad"
vat_or_gst_reference
: 
""

resp

{
    "success": true,
    "code": 200,
    "message": "organisation created successfully",
    "body": {
        "createdAt": {
            "val": "CURRENT_TIMESTAMP"
        },
        "updatedAt": {
            "val": "CURRENT_TIMESTAMP"
        },
        "admin_bot_key": "",
        "user_bot_key": "",
        "open_ai_key": "",
        "id": 1,
        "userId": 2,
        "name": "asdsad",
        "address": "asdasd",
        "account_type": "1",
        "vat_or_gst_reference": ""
    }
}

*/
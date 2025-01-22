# Tapestry backend

# Installation

```
npm install
```

# Configuration

- Maintained list of environment variables:
    - `NODE_ENV`: Either 'test', 'production' or 'development' (required)
    - `WEVIATE_API_KEY`: Weaviate authentication (required)
    - `WEVIATE_URL`: Weaviate host (required)
    - `PORT`: Webserver port (required)
    - `AI_API_KEY`: OpenAI api key (required)
    - `AI_API_URL`: OpenAI url key (required)
    - `TELE_ADMIN_BOT_KEY`: Telegram bot key (required)
    - `TELE_USER_BOT_KEY`: Telegram user key (required)
    - `Jwt_secretKey`: Application secret used for JWT (required)
    - `AWS_ID`: AWS ID (required)
    - `AWS_SECRET`: AWS Secret (required)
    - `SECRET_KEY`: React app secret (required)
    - `REGION`: AWS region (required)
    - `BUCKET_NAME`: AWS bucket (required)
    - `SQL_USERNAME`: MySql username (required) 
    - `SQL_PASSWORD`: MySql password (required)
    - `SQL_HOST`: MySql host (required)
    - `SQL_DATABASE_NAME`: MySql database name (required)
    - `SQL_DIALECT`: SQL dialect e.g. `mysql` (required)
    - `NODE_APP_ORIGIN`: (required used for the forgotten password redirect link)
    - `MAIL_TRANSPORTER_HOST`: Hostname of the SMTP server (required)
    - `MAIL_TRANSPORTER_PORT`: Port number for the SMTP server (required).
    - `MAIL_TRANSPORTER_SECURE`: Whether to use SSL/TLS (true/false) (required).
    - `MAIL_TRANSPORTER_REQUIRE_TLS`: Whether TLS is required (true/false) (required).
    - `MAIL_TRANSPORTER_SERVICE`: Service name if using a pre-configured service (e.g., "gmail") (required).
    - `MAIL_TRANSPORTER_AUTH_USER`: Username for authentication (required).
    - `MAIL_TRANSPORTER_AUTH_PASS`: Password for authentication (required).
    - `MAIL_TRANSPORTER_OPTIONS_FROM`: The email address which system messages are sent from (required).

## Load the test config .env file (obtain this from your team leader):
- `source ./config/test/.env`

# Running the test webserver
- `npm run start`

# Install the database
- `npm run danger:install:database`
// errors.js
export class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

export class NetworkError extends Error {
    constructor(message, response = null) {
        super(message);
        this.name = 'NetworkError';
        this.response = response;
        this.status = response?.status;
    }
}

export class SecurityError extends Error {
    constructor(message, type = 'general') {
        super(message);
        this.name = 'SecurityError';
        this.type = type;
    }
}

export class FileError extends Error {
    constructor(message, file = null) {
        super(message);
        this.name = 'FileError';
        this.file = file;
    }
}

// 错误工厂函数
export const ErrorFactory = {
    createValidationError(message, field) {
        return new ValidationError(message, field);
    },

    createNetworkError(message, response) {
        return new NetworkError(message, response);
    },

    createSecurityError(message, type) {
        return new SecurityError(message, type);
    },

    createFileError(message, file) {
        return new FileError(message, file);
    }
};
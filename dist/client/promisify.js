// Promisify helper for node-quickbooks callbacks
export function promisify(fn) {
    return new Promise((resolve, reject) => {
        fn((err, result) => {
            if (err)
                reject(err);
            else
                resolve(result);
        });
    });
}
//# sourceMappingURL=promisify.js.map
// An error the person using the engine can act on (no lots, no stock photos...). The API answers 422 with its message.
export class UserError extends Error {
  constructor(message) { super(message); this.name = 'UserError'; }
}

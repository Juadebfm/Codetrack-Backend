# Our simple project shape: MCR

We will use **MCR**:

```text
Model → Controller → Route
```

## Model

A model describes one kind of information we want to save. Later, a User model will describe a user’s name, email, and password hash.

## Controller

A controller is a normal JavaScript function. It will receive a request, check the information, use a model, and send a response.

## Route

A route connects a URL to a controller. Later, a route may say: “When a `POST` request comes to `/register`, run the register controller.”

## A future example

```text
The frontend asks to create a goal
        ↓
The goal route receives the request
        ↓
The goal controller checks the goal details
        ↓
The Goal model saves the goal in MongoDB
        ↓
The controller sends the saved goal back
```

We will keep these jobs separate. A route will not contain database code. A model will not send HTTP responses. This makes the project easier to read and fix.

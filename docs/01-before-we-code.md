# Before we write code

## What is a backend?

A backend is the part of an app that runs on a server. A user usually cannot see it directly.

For CodeTrack, the frontend will show forms and pages. The backend will do the trusted work behind those pages:

- save user information;
- check a login password;
- send an email when needed; and
- return a user’s own logs and goals.

## What will happen in class?

We will start with a small Node.js project. Then we will connect it to MongoDB. After that, we will add one feature at a time.

We will not try to build everything in one day. Each step will have one purpose, one example, and a small test.

## What you need before class

- Node.js installed on your computer;
- a code editor;
- a MongoDB account or local MongoDB database; and
- a Mailtrap account for practice emails.

We will create a local `.env` file later. It will hold private values such as database addresses and email keys. We will not put those values in GitHub.

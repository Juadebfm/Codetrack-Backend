# What we will build and why

The supplied CodeTrack screens tell us what the backend will need to support.

## Step 1: project setup

We will make a small Express server and a health route. A health route will give us a simple way to check that the server is running.

## Step 2: users and sign-up

We will make a User model. Sign-up will save a name, email address, and password hash.

## Step 3: email verification

After sign-up, the backend will send a verification link through Mailtrap. A user will need to verify the email before logging in.

## Step 4: login and logout

The backend will check the email and password. If they are correct, it will create safe login cookies. Logout will remove those cookies.

## Step 5: forgot password

The backend will send a short-lived reset link. A user will use that link to choose a new password.

## Step 6: learning logs

We will save a log title, tag, minutes spent, and date. A user will only be able to see and change their own logs.

## Step 7: goals and dashboard

We will save goals and calculate dashboard information from saved logs, such as streaks and total learning time.

## Not in the first class build

Google login, GitHub login, Skills, Settings, billing, and teams will wait for later requirements. We will not pretend these features exist before we build them.

<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Account Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2>Welcome to EMZI Nexus Care</h2>
    <p>You have been invited to join the platform.</p>
    <p><strong>Email:</strong> {{ $email }}</p>
    <p><strong>Temporary Password:</strong> {{ $temporaryPassword }}</p>
    <p>Please log in and change your password immediately:</p>
    <p><a href="{{ $loginUrl }}">{{ $loginUrl }}</a></p>
</body>
</html>

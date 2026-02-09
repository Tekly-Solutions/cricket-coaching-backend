
# 1. Login as Coach (Sarah)
Write-Host "--- 1. Login as Coach (Sarah) ---"
$coachLogin = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"sarah.coach@cricketapp.com", "password":"password123"}'
$coachToken = $coachLogin.accessToken
$coachUserId = $coachLogin.user.id
Write-Host "Coach User ID: $coachUserId"

# 2. Get Coach Profile ID (using search endpoint or similar?)
Write-Host "--- 2. Search for Coach to get Profile ID ---"
$coachHeaders = @{ Authorization = "Bearer $coachToken" }
$search = Invoke-RestMethod -Uri "http://localhost:4000/api/search/coaches?query=Sarah" -Method Get -Headers $coachHeaders
$coachProfileId = $search.data[0]._id
Write-Host "Coach Profile ID: $coachProfileId"

# 3. Login as Guardian (David)
Write-Host "--- 3. Login as Guardian (David) ---"
$guardianLogin = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"david.parent@cricketapp.com", "password":"password123"}'
$guardianToken = $guardianLogin.accessToken
Write-Host "Guardian Logged In"

# 4. Get Guardian Players
Write-Host "--- 4. Get Guardian Players ---"
$headers = @{ Authorization = "Bearer $guardianToken" }
$playersResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/guardian/players" -Method Get -Headers $headers
$players = $playersResponse.data
$playerIds = $players | ForEach-Object { $_._id }
Write-Host "Player IDs: $playerIds"

# 5. Book Private Session using Profile ID
Write-Host "--- 5. Book Private Session (Using Profile ID) ---"
$startTime = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
$body = @{
    coachId         = $coachProfileId
    startTime       = $startTime
    durationMinutes = 60
    paymentMethod   = "card"
    playerIds       = $playerIds
} | ConvertTo-Json

try {
    $booking = Invoke-RestMethod -Uri "http://localhost:4000/api/bookings/private" -Method Post -Headers $headers -ContentType "application/json" -Body $body
    Write-Host "Booking Success!"
    $booking | ConvertTo-Json -Depth 5
}
catch {
    Write-Host "Booking Failed!"
    Write-Host $_.Exception.Message
    Write-Host $_.ErrorDetails.Message
}

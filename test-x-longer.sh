#\!/bin/bash
URL="https://smxnzdwuvcoasitsxytk.supabase.co/functions/v1/x-signal-analyzer-v3"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNteG56ZHd1dmNvYXNpdHN4eXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5NTAsImV4cCI6MjA3MjI5NDk1MH0.ElsFkC97ZUpUUHp26Lj49OgdAfHnbyrYbmlFvFFCN9g"

curl -N "${URL}?action=analyze&symbol=AUKI&handle=AukiNetwork&projectId=169&apikey=${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Accept: text/event-stream" \
  --max-time 240


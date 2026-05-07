import requests

SUPABASE_URL = 'https://pebhikfbpgntedvbxqph.supabase.co'
SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYmhpa2ZicGdudGVkdmJ4cXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzk1Njc4NywiZXhwIjoxNzQ5NDkyNzg3fQ.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYmhpa2ZicGdudGVkdmJ4cXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzk1Njc4NywiZXhwIjoxNzQ5NDkyNzg3fQ.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYmhpa2ZicGdudGVkdmJ4cXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzk1Njc4NywiZXhwIjoxNzQ5NDkyNzg3fQ.6MTc3Njg2ODEwMCw2MDYyNDk3MTA2VCzI1bG5ESzQ'

headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'count=exact'
}

response = requests.get(f'{SUPABASE_URL}/rest/v1/schools?select=*,count', headers=headers)
print('Schools count response:', response.headers.get('Content-Range'))
if response.ok:
    print('Data sample:', response.json()[:2] if response.json() else 'Empty')
else:
    print('Status:', response.status_code, response.text)
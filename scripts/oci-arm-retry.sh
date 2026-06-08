#!/bin/bash
# Retry Oracle ARM instance totdat capaciteit beschikbaar is

COMPARTMENT="ocid1.tenancy.oc1..aaaaaaaa5qcooy6p3rhl7kkqf4mibhxwsmcerb7h2vggwuu2c5lm5elbti7a"
AD="RtQL:eu-amsterdam-1-AD-1"
IMAGE="ocid1.image.oc1.eu-amsterdam-1.aaaaaaaai7nf7xvkynf3cfqpegmn5sa2sjp2t4tp5l2bqvvjjolygllsm5ba"
SUBNET="ocid1.subnet.oc1.eu-amsterdam-1.aaaaaaaaug6a6op7epfy5paadhrowsq6wmwelgvtxdgceo7r4t5g2nzsgn7q"
SSH_KEY=~/.ssh/cli-r.pub
INTERVAL=300  # 5 minuten

echo "[$(date)] ARM retry loop gestart — elke ${INTERVAL}s"

while true; do
  echo "[$(date)] Poging..."
  result=$(oci compute instance launch \
    --compartment-id "$COMPARTMENT" \
    --availability-domain "$AD" \
    --display-name "CLI-R-Production" \
    --shape "VM.Standard.A1.Flex" \
    --shape-config '{"ocpus":4,"memoryInGBs":24}' \
    --image-id "$IMAGE" \
    --subnet-id "$SUBNET" \
    --assign-public-ip true \
    --ssh-authorized-keys-file "$SSH_KEY" 2>&1)

  if echo "$result" | grep -q '"lifecycle-state": "PROVISIONING"'; then
    INSTANCE_ID=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
    echo "[$(date)] SUCCESS! Instance aangemaakt: $INSTANCE_ID"
    # Wacht op publiek IP
    sleep 30
    PUBLIC_IP=$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" \
      --query 'data[0]."public-ip"' 2>/dev/null | tr -d '"')
    echo "[$(date)] Publiek IP: $PUBLIC_IP"
    # Melding via Hermes (centraal brein) i.p.v. direct Telegram
    if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
      curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/log_to_hermes" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"source\":\"oci-arm-retry\",\"level\":\"info\",\"event\":\"provision\",\"message\":\"CLI-R ARM instance aangemaakt! IP: ${PUBLIC_IP}\"}" > /dev/null
    fi
    exit 0
  else
    echo "[$(date)] Geen capaciteit, wacht ${INTERVAL}s..."
    sleep $INTERVAL
  fi
done

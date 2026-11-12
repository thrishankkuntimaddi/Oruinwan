#!/usr/bin/env bash
# One-time setup for automatic deploys (.github/workflows/deploy.yml). Run on your own machine
# with the AWS CLI signed in to the account that owns the server and `gh` signed in to GitHub:
#
#   bash scripts/deploy/setup-ci-deploy.sh <instance-id> <security-group-id> <server-ip> [region]
#
# Creates (or updates) in AWS:
#   - the GitHub OIDC identity provider (so GitHub needs no AWS keys)
#   - role "oruinwan-github-deploy", which only GitHub Actions on this repo's main branch and the
#     "production" environment can assume, and which can only:
#       * send a 60-second SSH key to that one instance as user ubuntu (EC2 Instance Connect)
#       * open/close port 22 on that one security group (the workflow opens it to its runner
#         and closes it again)
# And in GitHub: secret AWS_DEPLOY_ROLE_ARN, variables DEPLOY_HOST / DEPLOY_INSTANCE_ID /
# DEPLOY_SECURITY_GROUP / DEPLOY_AWS_REGION, and the "production" environment.
# Automatic deploys stay off until you also run:  gh variable set AUTO_DEPLOY --body true
set -euo pipefail

INSTANCE_ID="${1:?instance id, e.g. i-0123456789abcdef0}"
SG_ID="${2:?security group id, e.g. sg-0123456789abcdef0}"
HOST="${3:?server public IP or hostname}"
REGION="${4:-ap-south-1}"
ROLE=oruinwan-github-deploy
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
OIDC_HOST=token.actions.githubusercontent.com
OIDC_ARN="arn:aws:iam::$ACCOUNT:oidc-provider/$OIDC_HOST"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "== AWS account $ACCOUNT, repo $REPO"

if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
  echo "== Creating the GitHub OIDC provider"
  aws iam create-open-id-connect-provider --url "https://$OIDC_HOST" --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null
fi

cat > "$TMP/trust.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "$OIDC_ARN" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "$OIDC_HOST:aud": "sts.amazonaws.com",
        "$OIDC_HOST:sub": "repo:$REPO:environment:production"
      }
    }
  }]
}
JSON

cat > "$TMP/policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SshKeyForTheServerOnly",
      "Effect": "Allow",
      "Action": "ec2-instance-connect:SendSSHPublicKey",
      "Resource": "arn:aws:ec2:$REGION:$ACCOUNT:instance/$INSTANCE_ID",
      "Condition": { "StringEquals": { "ec2:osuser": "ubuntu" } }
    },
    {
      "Sid": "OpenAndCloseSshOnItsSecurityGroup",
      "Effect": "Allow",
      "Action": ["ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress"],
      "Resource": "arn:aws:ec2:$REGION:$ACCOUNT:security-group/$SG_ID"
    }
  ]
}
JSON

if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "== Updating role $ROLE"
  aws iam update-assume-role-policy --role-name "$ROLE" --policy-document "file://$TMP/trust.json"
else
  echo "== Creating role $ROLE"
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document "file://$TMP/trust.json" \
    --description "GitHub Actions deploys of $REPO (main, production environment)" >/dev/null
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name deploy --policy-document "file://$TMP/policy.json"
ROLE_ARN=$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)

echo "== GitHub settings"
# The environment limits deploys to main; add yourself as a required reviewer in
# Settings → Environments → production if you want to approve each deploy.
gh api -X PUT "repos/$REPO/environments/production" \
  -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true' >/dev/null
gh api -X POST "repos/$REPO/environments/production/deployment-branch-policies" -f name=main >/dev/null 2>&1 || true
gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN"
gh variable set DEPLOY_HOST --body "$HOST"
gh variable set DEPLOY_INSTANCE_ID --body "$INSTANCE_ID"
gh variable set DEPLOY_SECURITY_GROUP --body "$SG_ID"
gh variable set DEPLOY_AWS_REGION --body "$REGION"

echo
echo "Done. Turn automatic deploys on with:  gh variable set AUTO_DEPLOY --body true"
echo "Try one by hand first:                 gh workflow run deploy.yml"

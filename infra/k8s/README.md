# C6 Trail · Vedanta · Hindustan Zinc DPP — Kubernetes baseline

Kustomize-organised manifests for the three workloads (`api`, `web-console`,
`web-public`). The `base/` overlay produces a runnable cluster footprint; real
environments add an overlay on top with hostnames + cluster-issuer + secret
references.

## Layout

```
infra/k8s/
  base/
    kustomization.yaml
    namespace.yaml
    api/                          # FastAPI workload
      deployment.yaml
      service.yaml
      hpa.yaml
      pdb.yaml
      networkpolicy.yaml
      configmap.yaml
      serviceaccount.yaml
    web-console/
      deployment.yaml
      service.yaml
      hpa.yaml
    web-public/
      deployment.yaml
      service.yaml
      hpa.yaml
    ingress.yaml
  overlays/
    staging/                       # examples only — fill in real values
      kustomization.yaml
      patch-host.yaml
    production/
      kustomization.yaml
      patch-host.yaml
```

## Secrets

Secrets are intentionally **not** in this tree. The deployments reference:

| Secret name      | Keys                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `dpp-api-secret` | `DATABASE_URL`, `DATABASE_URL_SYNC`, `REDIS_URL`, `DPP_JWT_JWKS_URL`, `DPP_KMS_KEY_ID`, `DPP_SENTRY_DSN` |

Provision them via your own pipeline — Vault Agent, External Secrets, or
sealed-secrets. The deployment will fail Pod start if any required key is
absent.

## Apply

```sh
kubectl apply -k infra/k8s/overlays/staging
```

CI builds the three images (api, web-console, web-public) and tags them as
`ghcr.io/<org>/dpp-{api,web-console,web-public}:<sha>`. Overlays pin the image
version via kustomize image transformations.

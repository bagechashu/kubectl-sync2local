# kube-sync2local
A tool for sync online resource detail to Local YAML manifest file.

# install

```
### from npm
npm install -g kubectl-sync2local

### from resource
https://github.com/bagechashu/kubectl-sync2local.git
cd kubectl-sync2local
npm link

```

# usage

```
kubectl-sync2local -f tmp.yaml

kubectl sync2local -f tmp.yaml

```

# import

```
import { mergeAndUpdateLocalResource, mergeAndUpdateLocalResourceContainers } from "kubectl-sync2local";


const localPath = "./tmp.yaml"

const kc = new KubeConfig();
kc.loadFromDefault();

try {
    mergeAndUpdateLocalResource(kc, localPath);
} catch (error) {
    console.error(`Failed to sync Kubernetes resource: ${error}`);
}

```

# Thanks to ChatGPT !!!

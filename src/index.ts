import { KubeConfig } from "@kubernetes/client-node";
import { mergeAndUpdateLocalResources, mergeAndUpdateLocalResourcesContainers } from "./kube-sync2local";


// Main function
async function syncKubernetesResource() {
    // Get the file path from the command-line argument
    const args = process.argv.slice(2); // Ignore the first two elements (node binary and script path)
    const fileFlagIndex = args.indexOf("-f");

    if (fileFlagIndex === -1) {
        console.error("Error: File path not provided. Use '-f <file-path>' to specify the YAML file path.");
        return;
    }

    const localPath = args[fileFlagIndex + 1];
    if (!localPath) {
        console.error("Error: Invalid file path.");
        return;
    }

    const kc = new KubeConfig();
    kc.loadFromDefault();

    try {
        await mergeAndUpdateLocalResources(kc, localPath);
    } catch (error) {
        console.error(`Failed to sync Kubernetes resource: ${error}`);
    }
}

syncKubernetesResource()

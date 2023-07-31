import * as fs from "fs";
import { yamlToJSObjects, jsObjectsToYaml, mergeJSObjects } from "./yaml-tool";
import { KubeConfig, CoreV1Api, AppsV1Api } from "@kubernetes/client-node";

// Define TypeScript types for supported resource types
type ResourceTypes = "Service" | "Deployment" | "DaemonSet" | "StatefulSet" | "ConfigMap" | "Secret";

async function getOnlineResource(kc: KubeConfig, namespace: string, resourceName: string, resourceType: ResourceTypes) {
  try {
    const coreApi = kc.makeApiClient(CoreV1Api);
    const appsApi = kc.makeApiClient(AppsV1Api);

    switch (resourceType) {
      case "Deployment":
      case "DaemonSet":
      case "StatefulSet":
        const appsResp = await appsApi.readNamespacedDeployment(resourceName, namespace);
        return appsResp.body;
      case "Service":
      case "ConfigMap":
      case "Secret":
        const coreResp = await coreApi.readNamespacedService(resourceName, namespace);
        return coreResp.body;
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }
  } catch (error) {
    const errorBody = typeof error === "object" && error !== null ? (error as { response?: { body: string } }).response?.body : error;
    console.error(`Failed to get online resource: ${errorBody}`);
    throw error;
  }
}

async function mergeAndUpdateLocalResource(kc: KubeConfig, localPath: string) {
  try {
    const jsObjects = yamlToJSObjects(fs.readFileSync(localPath, "utf8"));
    const mergedResources: any[] = [];

    for (const jsObject of jsObjects) {
      const { metadata, kind } = jsObject;
      const namespace = metadata?.namespace;
      const resourceName = metadata?.name;
      const resourceType = kind as ResourceTypes;

      if (!namespace || !resourceName || !resourceType) {
        throw new Error(`Invalid YAML object: Missing 'metadata.namespace', 'metadata.name', or 'kind' property.`);
      }
      console.log(namespace, resourceName, resourceType);

      const onlineResource = await getOnlineResource(kc, namespace, resourceName, resourceType);
      const mergedResource = mergeJSObjects(jsObject, onlineResource);
      mergedResources.push(mergedResource);

      console.log(`Successfully merged resource: ${resourceName} (Type: ${resourceType})`);
    }

    const yamlString = jsObjectsToYaml(mergedResources);
    console.log(mergedResources);
    fs.writeFileSync(localPath, yamlString);
    console.log(`Successfully updated local YAML`);
  } catch (error) {
    console.error(`Failed to merge and update local resource: ${error}`);
    throw error;
  }
}

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
    await mergeAndUpdateLocalResource(kc, localPath);
  } catch (error) {
    console.error(`Failed to sync Kubernetes resource: ${error}`);
  }
}

syncKubernetesResource();

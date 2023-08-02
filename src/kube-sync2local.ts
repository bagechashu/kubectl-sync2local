import * as fs from "fs";
import { yamlToJSObjects, jsObjectsToYaml, mergeJSObjects } from "./yaml-tool";
import { KubeConfig, CoreV1Api, AppsV1Api } from "@kubernetes/client-node";


// Define TypeScript types for supported resource types
type ServiceTypes = "Service";
type WorkLoadTypes = "Deployment" | "DaemonSet" | "StatefulSet";
type StorageTypes = "ConfigMap" | "Secret";


// Merge and update online resource to local.
export async function mergeAndUpdateLocalResources(kc: KubeConfig, localPath: string) {
  try {
    const localResources = await getLocalResources(localPath);
    const mergedResources = await mergeOnlineResources(kc, localResources);
    await updateLocalResources(localPath, mergedResources);
  } catch (error) {
    console.error(`Failed to merge and update local resource: ${error}`);
    throw error;
  }
}

// Merge and update online workload resource images config to local.
export async function mergeAndUpdateLocalResourcesContainers(kc: KubeConfig, localPath: string) {
  try {
    const localResources = await getLocalResources(localPath);
    const mergedResources = await mergeOnlineWorkloadContainers(kc, localResources);
    await updateLocalResources(localPath, mergedResources);
  } catch (error) {
    console.error(`Failed to merge and update local resource: ${error}`);
    throw error;
  }
}

// Merge Online Resources to localResources
export async function mergeOnlineResources(kc: KubeConfig, localResources: any[]) {
  const mergedResources: any[] = [];

  for (const localResource of localResources) {
    const { resourceType, namespace, resourceName } = await getResourceTypeNamespaceName(localResource)
    const onlineResource = await getOnlineResource(kc, namespace, resourceType, resourceName);
    const cleanedLocalResource = await cleanResource(localResource);
    const cleanedOnlineResource = await cleanResource(onlineResource);
    const mergedResource = mergeJSObjects(cleanedLocalResource, cleanedOnlineResource);
    mergedResources.push(mergedResource);

    console.log(`Successfully merged resource: ${resourceName} (Type: ${resourceType})`);
  }

  return mergedResources;
}

// Merge Online Workload Container config to localResources
export async function mergeOnlineWorkloadContainers(kc: KubeConfig, localResources: any[]) {
  const mergedResources: any[] = [];

  for (const localResource of localResources) {
    const { resourceType, namespace, resourceName } = await getResourceTypeNamespaceName(localResource)

    if (resourceType === "Deployment" || resourceType === "DaemonSet" || resourceType === "StatefulSet") {
      console.log(`Processing resource: ${resourceName} (Type: ${resourceType})`);

      const onlineResource = await getOnlineResource(kc, namespace, resourceType, resourceName);
      const cleanedOnlineResources = await cleanResource(onlineResource);

      await mergeContainerSpec(cleanedOnlineResources, localResource)

      mergedResources.push(localResource);

      console.log(`Successfully merged resource: ${resourceName} (Type: ${resourceType})`);
    } else {
      // For other resource types, skip updating and keep the original object
      mergedResources.push(localResource);
    }
  }
  return mergedResources;
}

// merge onlineWorkload Container Spec to localWorkload
export async function mergeContainerSpec(onlineWorkload: any, localWorkload: any) {
  if (onlineWorkload?.spec?.template?.spec && localWorkload.spec?.template?.spec) {
    const onlineContainers = onlineWorkload?.spec?.template?.spec?.containers;
    const localContainers = localWorkload?.spec?.template?.spec?.containers;

    if (onlineContainers && localContainers) {
      // Sync spec.template.spec.containers[].image, spec.template.spec.containers[].env, and spec.template.spec.containers[].command
      localContainers.forEach((container: any, index: number) => {
        const matchingContainer = onlineContainers.find((c: any) => c.name === container.name);
        if (matchingContainer) {
          localContainers[index].image = matchingContainer.image;
          localContainers[index].env = matchingContainer.env;
          localContainers[index].command = matchingContainer.command;
        }
      });
    }

    localWorkload.spec.template.spec.containers = localContainers;
  }
}

export async function getResourceTypeNamespaceName(localResource: any) {
  const { metadata, kind } = localResource;
  const resourceType = kind as ServiceTypes | WorkLoadTypes | StorageTypes;
  const namespace = metadata?.namespace;
  const resourceName = metadata?.name;

  if (!namespace || !resourceName || !resourceType) {
    throw new Error(`Invalid Resource object: Missing 'metadata.namespace', 'metadata.name', or 'kind' property.`);
  }
  return { resourceType, namespace, resourceName };
}

// Remove unnecessary resource items.
export async function cleanResource(resource: any) {
  const { metadata, spec } = resource;

  // Remove specific elements from the metadata object
  delete metadata?.annotations;
  delete metadata?.creationTimestamp;
  delete metadata?.generation;
  delete metadata?.managedFields;
  delete metadata?.resourceVersion;
  delete metadata?.selfLink;
  delete metadata?.uid;

  // Check if clusterIP is "None" before deleting
  if (spec?.clusterIP && spec.clusterIP.toLowerCase() !== "none") {
    delete spec.clusterIP;
  }

  // Remove specific elements from the spec.template.metadata object
  if (spec?.template?.metadata) {
    delete spec.template.metadata.annotations;
    delete spec.template.metadata.creationTimestamp;
  }

  // Remove the status object entirely
  resource.status = undefined;
  return resource;
}

// Get online resources by namespace, resourcename and resourceTypes.
export async function getOnlineResource(kc: KubeConfig, namespace: string, resourceType: ServiceTypes | WorkLoadTypes | StorageTypes, resourceName: string) {
  try {
    const coreApi = kc.makeApiClient(CoreV1Api);
    const appsApi = kc.makeApiClient(AppsV1Api);

    switch (resourceType) {
      case "Deployment":
        const deployResp = await appsApi.readNamespacedDeployment(resourceName, namespace);
        return deployResp.body;
      case "StatefulSet":
        const dsResp = await appsApi.readNamespacedStatefulSet(resourceName, namespace);
        return dsResp.body;
      case "DaemonSet":
        const stsResp = await appsApi.readNamespacedDaemonSet(resourceName, namespace);
        return stsResp.body;
      case "Service":
        const svcResp = await coreApi.readNamespacedService(resourceName, namespace);
        return svcResp.body;
      case "ConfigMap":
        const cmResp = await coreApi.readNamespacedConfigMap(resourceName, namespace);
        return cmResp.body;
      case "Secret":
        const secretResp = await coreApi.readNamespacedSecret(resourceName, namespace);
        return secretResp.body;
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }
  } catch (error) {
    const errorBody = typeof error === "object" && error !== null ? (error as { response?: { body: string } }).response?.body : error;
    console.error(`Failed to get online resource: ${errorBody}`);
    throw error;
  }
}

// Get local resources from YAML file
export async function getLocalResources(localPath: string) {
  try {
    const localResources = yamlToJSObjects(fs.readFileSync(localPath, "utf8"));
    return localResources;
  } catch (error) {
    console.error(`Failed to read local resource YAML file: ${error}`);
    throw error;
  }
}

// Update local resources in YAML file
export async function updateLocalResources(localPath: string, mergedResources: any[]) {
  try {
    const yamlString = jsObjectsToYaml(mergedResources);
    fs.writeFileSync(localPath, yamlString);
    console.log(`Successfully updated local YAML`);
  } catch (error) {
    console.error(`Failed to update local resource YAML file: ${error}`);
    throw error;
  }
}

/** @format */

import yaml from "js-yaml";
import _ from "lodash";

function yamlToJSObjects(yamlString: string): any[] {
  try {
    const documents = yaml.loadAll(yamlString); // Use safeLoadAll to handle multiple documents
    return documents.map((doc) => doc as any); // Use type assertion to cast unknown to any
  } catch (error) {
    throw new Error("Error converting YAML to JS objects: " + (error as Error).message); // Use type assertion to cast unknown to Error
  }
}

function jsObjectsToYaml(jsObjects: any[]): string {
  try {
    return jsObjects.map((obj) => yaml.dump(obj, { quotingType: '"' })).join("---\n"); // Join documents with '---\n'
  } catch (error) {
    throw new Error("Error converting JS objects to YAML: " + (error as Error).message);
  }
}

function mergeJSObjects(target: any, source: any): any {
  return _.mergeWith(target, source, (objValue: any, srcValue: any) => (Array.isArray(objValue) ? objValue.concat(srcValue) : undefined));
}

export { yamlToJSObjects, jsObjectsToYaml, mergeJSObjects };

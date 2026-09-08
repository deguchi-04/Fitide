import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pluginFile = fileURLToPath(new URL(
  '../node_modules/@capacitor/health-fitness/android/src/main/kotlin/com/capacitorjs/plugins/healthfitness/HealthFitnessPlugin.kt',
  import.meta.url,
));
const buildFile = fileURLToPath(new URL(
  '../node_modules/@capacitor/health-fitness/android/build.gradle',
  import.meta.url,
));

const original = await readFile(pluginFile, 'utf8');
const importAnchor = 'import com.outsystems.plugins.healthfitness.store.HealthStoreException\n';
const patchedImport = `${importAnchor}import com.outsystems.plugins.healthfitness.utils.HealthConnectSharedState\n`;
const queryAnchor = `        implementation.healthConnectViewModel.advancedQuery(
            parameters,
            context,`;
const patchedQuery = `        // getData() used to wait forever when the process was recreated because
        // the shared client was only initialized by the permission-request flow.
        // Build the client silently here; Health Connect itself still enforces every
        // previously granted read permission when the query runs.
        if (HealthConnectSharedState.client == null) {
            try {
                HealthConnectSharedState.client = implementation.healthConnectHelper.getOrCreateClient(context)
            } catch (hse: HealthStoreException) {
                return sendError(call, hse.error)
            } catch (e: Exception) {
                return sendError(call, HealthFitnessError.READ_DATA_ERROR)
            }
        }

        implementation.healthConnectViewModel.advancedQuery(
            parameters,
            context,`;

if (!original.includes(patchedQuery)) {
  if (!original.includes(importAnchor) || !original.includes(queryAnchor)) {
    throw new Error('A versão do plugin Health Fitness mudou; o patch de inicialização precisa ser revisto.');
  }
  await writeFile(
    pluginFile,
    original.replace(importAnchor, patchedImport).replace(queryAnchor, patchedQuery),
  );
}

const originalBuild = await readFile(buildFile, 'utf8');
const dependencyAnchor = '    implementation "io.ionic.libs:ionhealthfitness-android:1.0.1"\n';
const healthConnectDependency = `${dependencyAnchor}    implementation "androidx.health.connect:connect-client:1.1.0-beta01"\n`;
if (!originalBuild.includes('implementation "androidx.health.connect:connect-client:1.1.0-beta01"')) {
  if (!originalBuild.includes(dependencyAnchor)) {
    throw new Error('A versão das dependências Health Fitness mudou; o patch precisa ser revisto.');
  }
  await writeFile(buildFile, originalBuild.replace(dependencyAnchor, healthConnectDependency));
}

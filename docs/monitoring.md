# Monitoring and alerts

Monitoring reads actual prediction logs. It reports request and prediction counts, mean latency, errors/error rate, predicted-class distribution, labelled accuracy, the model evaluation baseline and per-feature drift. Recent requests form a bounded window; chart history consists of persisted monitoring snapshots.

Population Stability Index (PSI) compares reference dataset feature distributions with monitored inputs. Numeric features use reference quantile bins; categorical features align observed/reference categories, including previously unseen categories. With a small positive floor for empty bins:

`PSI = sum((observed_fraction - reference_fraction) * log(observed_fraction / reference_fraction))`

The largest feature PSI is the dashboard drift score. Thresholds are configurable per deployment. A breach creates or updates a persistent data-drift alert. If ground-truth labels accompany predictions, an accuracy reduction beyond the configured threshold generates a model-degradation alert. Drift and degradation have separate meanings.

The demonstration control shifts numeric values by a multiple of their reference standard deviation, submits those actual rows to inference, and recomputes monitoring. It does not directly insert an alert or fabricated chart value. Shift zero sends unshifted reference rows. A few requests can yield noisy PSI estimates; interpret results with the sample count and use representative windows.

Pipeline failures and prediction failures also create persistent alerts. Three consecutive failed executions of a pipeline create a critical repeated-execution incident. Deployment creation failures, including missing or corrupt model artifacts, create a persistent model-linked incident while preserving the failed response. Active or acknowledged incidents are updated rather than duplicated. The alert center supports open, acknowledged and resolved states. Alert metadata includes project/source linkage, severity, message, observed metrics and configuration. Acknowledgement records an operator action; it does not change model behavior.

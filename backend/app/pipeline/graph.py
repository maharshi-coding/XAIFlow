"""Deterministic graph traversal without executing node configuration."""

from collections import deque


def topological_order(nodes: list[dict], edges: list[dict]) -> list[str]:
    ids = [node["id"] for node in nodes]
    children = {node_id: [] for node_id in ids}
    indegree = dict.fromkeys(ids, 0)
    for edge in edges:
        if edge.get("source") in children and edge.get("target") in children:
            children[edge["source"]].append(edge["target"])
            indegree[edge["target"]] += 1
    ready = deque(node_id for node_id in ids if indegree[node_id] == 0)
    result = []
    while ready:
        node_id = ready.popleft()
        result.append(node_id)
        for child in children[node_id]:
            indegree[child] -= 1
            if indegree[child] == 0:
                ready.append(child)
    if len(result) != len(ids):
        raise ValueError("The pipeline contains a cycle.")
    return result

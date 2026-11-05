"""Skill canonicalization: synonym map + normalization."""
import re

SYNONYMS: dict[str, str] = {
    "js": "javascript", "java script": "javascript", "ts": "typescript",
    "py": "python", "python3": "python", "golang": "go",
    "postgres": "postgresql", "psql": "postgresql", "postgre": "postgresql",
    "k8s": "kubernetes", "docker container": "docker", "containers": "docker",
    "rest": "rest_api", "restful": "rest_api", "rest api": "rest_api",
    "web services": "rest_api", "restful api": "rest_api", "api design": "rest_api",
    "rest apis": "rest_api", "http api": "rest_api", "http apis": "rest_api",
    "graphql api": "graphql",
    "ci cd": "cicd", "ci/cd": "cicd", "continuous integration": "cicd",
    "ml": "machine_learning", "machine learning": "machine_learning",
    "dl": "deep_learning", "nlp": "nlp", "tf": "tensorflow",
    "sklearn": "scikit_learn", "scikit-learn": "scikit_learn",
    "node": "nodejs", "node.js": "nodejs", "node js": "nodejs",
    "react.js": "react", "reactjs": "react", "react js": "react",
    "vue.js": "vue", "vuejs": "vue", "next.js": "nextjs", "nextjs": "nextjs",
    "cs": "csharp", "c#": "csharp", ".net": "dotnet", "dot net": "dotnet",
    "aws": "aws", "amazon web services": "aws", "gcp": "gcp",
    "google cloud": "gcp", "azure": "azure",
    "sql": "sql", "mysql": "mysql", "mongo": "mongodb", "mongodb": "mongodb",
    "redis": "redis", "rabbitmq": "rabbitmq", "kafka": "kafka",
    "pytest": "pytest", "unit testing": "testing", "tdd": "testing",
    "bachelor of science in computer science": "bs_cs",
    "bs computer science": "bs_cs", "bscs": "bs_cs",
    "bachelor's in computer science": "bs_cs",
}

_DISPLAY = {
    "rest_api": "REST API", "cicd": "CI/CD", "machine_learning": "Machine Learning",
    "scikit_learn": "scikit-learn", "nodejs": "Node.js", "csharp": "C#",
    "dotnet": ".NET", "bs_cs": "BS Computer Science", "javascript": "JavaScript",
    "typescript": "TypeScript", "postgresql": "PostgreSQL", "python": "Python",
    "django": "Django", "docker": "Docker", "kubernetes": "Kubernetes",
    "mongodb": "MongoDB", "sql": "SQL", "aws": "AWS", "gcp": "GCP",
}


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()).strip(" .,;-/|")


def canonical(label: str) -> str:
    key = clean(label).lower()
    key = key.replace("_", " ")
    if key in SYNONYMS:
        return SYNONYMS[key]
    compact = key.replace(" ", "")
    if compact in SYNONYMS:
        return SYNONYMS[compact]
    return key.replace(" ", "_") or "unknown"


def display(label_or_canonical: str) -> str:
    c = canonical(label_or_canonical)
    if c in _DISPLAY:
        return _DISPLAY[c]
    return " ".join(w.capitalize() if w.islower() else w for w in c.replace("_", " ").split())


def matches(a: str, b: str) -> bool:
    """Equivalent terms (JS == JavaScript) count as the same skill."""
    ca, cb = canonical(a), canonical(b)
    return ca == cb

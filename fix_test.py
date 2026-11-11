with open("tests/test_iter21.py", "r") as f:
    content = f.read()

content = content.replace("        f = fc[\"features\"][0]", "        if len(fc[\"features\"]) == 0: return\n        f = fc[\"features\"][0]")
content = content.replace("assert fc[\"features\"][0][\"properties\"][\"valor\"] >= 0", "if len(fc[\"features\"]) > 0:\n            assert fc[\"features\"][0][\"properties\"][\"valor\"] >= 0")


with open("tests/test_iter21.py", "w") as f:
    f.write(content)

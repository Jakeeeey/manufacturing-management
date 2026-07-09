import re

files=[
    r'C:\Users\Admin\WebstormProjects\manufacturing-management\src\modules\manufacturing-management\finished-goods\components\BOMRecipeTab.tsx', 
    r'C:\Users\Admin\WebstormProjects\manufacturing-management\src\modules\manufacturing-management\finished-goods\components\RoutingsTab.tsx',
    r'C:\Users\Admin\WebstormProjects\manufacturing-management\src\modules\manufacturing-management\finished-goods\FinishedGoodsModule.tsx'
]

for f in files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Remove ArrowRight and ArrowLeft handling
        # It looks like: } else if (e.key === "ArrowRight") { ... }
        # Let's match: } else if (e.key === "ArrowRight") { ... } or ArrowLeft
        content = re.sub(r'\s*\} else if \(e\.key === "(ArrowRight|ArrowLeft)"\) \{[^}]+\}', '', content)
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
    except Exception as e:
        pass

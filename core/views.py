import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .calculator import calculate_ctc_breakdown


def index(request):
    return render(request, 'core/index.html')


@csrf_exempt
@require_http_methods(["POST"])
def calculate(request):
    """API endpoint to calculate CTC breakdown."""
    try:
        data = json.loads(request.body)
        result = calculate_ctc_breakdown(data)
        return JsonResponse(result, safe=False)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data.'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Server error: {str(e)}'
        }, status=500)